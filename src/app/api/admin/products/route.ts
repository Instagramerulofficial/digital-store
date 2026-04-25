import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env, isAdminEmail } from "@/lib/env";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Admin products API.
 *
 *   GET    ?id=uuid    -> fetch one product (admin view)
 *   POST   (form-data) -> create (file upload to Supabase Storage)
 *   PATCH  (json)      -> update fields (id required in body)
 *   DELETE ?id=uuid    -> delete product + its file
 */
async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not signed in" };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const allowed = !!profile?.is_admin || isAdminEmail(user.email);
  if (!allowed) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, user };
}

export async function GET(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product: data });
}

export async function POST(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const priceStr = String(form.get("price") ?? "0");
    const category = (String(form.get("category") ?? "").trim() || null) as
      | string
      | null;
    const imageUrl = (String(form.get("image_url") ?? "").trim() || null) as
      | string
      | null;
    const isPublished =
      form.get("is_published") === "on" || form.get("is_published") === "true";
    const file = form.get("file") as File | null;

    if (!title)
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const priceCents = Math.round(parseFloat(priceStr) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const path = `files/${slug}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(env.supabaseBucket)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      console.error("[admin/products] upload failed:", upErr);
      return NextResponse.json(
        { error: `Upload failed: ${upErr.message}` },
        { status: 500 },
      );
    }

    const { data: product, error: insErr } = await admin
      .from("products")
      .insert({
        slug,
        title,
        description,
        price_cents: priceCents,
        currency: "usd",
        image_url: imageUrl,
        file_path: path,
        file_name: file.name,
        file_size_bytes: bytes.length,
        category,
        is_published: isPublished,
      })
      .select()
      .single();

    if (insErr) {
      await admin.storage.from(env.supabaseBucket).remove([path]);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[admin/products] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.category === "string")
    patch.category = body.category || null;
  if (typeof body.image_url === "string")
    patch.image_url = body.image_url || null;
  if (typeof body.is_published === "boolean")
    patch.is_published = body.is_published;
  if (typeof body.price_cents === "number" && body.price_cents >= 0)
    patch.price_cents = Math.round(body.price_cents);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("products").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (product?.file_path) {
    await admin.storage.from(env.supabaseBucket).remove([product.file_path]);
  }
  return NextResponse.json({ ok: true });
}
