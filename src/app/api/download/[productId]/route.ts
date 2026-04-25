import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// Signed-URL TTL in seconds.
// The link expires 24 hours after it is issued, so a customer who opens the
// email a few hours later still gets a working download.
const SIGNED_URL_TTL = 60 * 60 * 24;

/**
 * Secure file download.
 * Flow:
 *   1. Require authenticated user (Supabase SSR cookies).
 *   2. Verify a row exists in `purchases` for (user_id, product_id).
 *   3. Create a short-lived signed URL against the PRIVATE storage bucket.
 *   4. Bump the download audit counter.
 *   5. Redirect the browser to the signed URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to download." },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: grant, error: grantErr } = await admin
    .from("purchases")
    .select("id, download_count")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (grantErr) {
    console.error("[download] grant lookup failed:", grantErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!grant) {
    return NextResponse.json(
      { error: "You don't own this product." },
      { status: 403 },
    );
  }

  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, file_path, file_name")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(env.supabaseBucket)
    .createSignedUrl(product.file_path, SIGNED_URL_TTL, {
      download: product.file_name,
    });
  if (signErr || !signed) {
    console.error("[download] signing failed:", signErr);
    return NextResponse.json(
      { error: "Could not create download link." },
      { status: 500 },
    );
  }

  await admin
    .from("purchases")
    .update({
      download_count: grant.download_count + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", grant.id);

  // Append an immutable audit entry for analytics / abuse detection.
  const hdrs = request.headers;
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;
  await admin.from("downloads").insert({
    user_id: user.id,
    product_id: productId,
    purchase_id: grant.id,
    ip,
    user_agent: hdrs.get("user-agent"),
  });

  return NextResponse.redirect(signed.signedUrl);
}
