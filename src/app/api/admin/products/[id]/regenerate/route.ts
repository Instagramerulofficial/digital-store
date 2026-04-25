import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { regenerateSection } from "@/lib/ai/openai";
import type { AiGeneratedProduct, GenerationInput } from "@/types/db";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_SECTIONS = [
  "title",
  "subtitle",
  "description",
  "outline",
  "content",
  "faq",
  "call_to_action",
  "tags",
] as const;

type SectionKey = (typeof ALLOWED_SECTIONS)[number];

function isSection(v: unknown): v is SectionKey {
  return typeof v === "string" && (ALLOWED_SECTIONS as readonly string[]).includes(v);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const section = body.section;
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  if (!isSection(section)) {
    return NextResponse.json(
      { error: `Unknown section. Allowed: ${ALLOWED_SECTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  // Load the current version + its input.
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, current_version_id, generation_prompt")
    .eq("id", id)
    .maybeSingle();
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.current_version_id) {
    return NextResponse.json(
      { error: "Product has no current version — nothing to regenerate" },
      { status: 400 },
    );
  }
  if (!product.generation_prompt) {
    return NextResponse.json(
      {
        error:
          "This product has no generation_prompt — it wasn't created by the AI generator.",
      },
      { status: 400 },
    );
  }

  const { data: version, error: versionErr } = await admin
    .from("product_versions")
    .select("version_no, generated_json")
    .eq("id", product.current_version_id)
    .maybeSingle();
  if (versionErr || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const current = version.generated_json as AiGeneratedProduct;
  const input = product.generation_prompt as GenerationInput;

  let replaced: unknown;
  try {
    replaced = await regenerateSection({
      section: section as keyof AiGeneratedProduct,
      current: current[section as keyof AiGeneratedProduct] as never,
      input,
      notes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI regeneration failed";
    console.error("[admin/regenerate] AI failed:", err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const next = {
    ...current,
    [section]: replaced,
  } as unknown as AiGeneratedProduct;

  // Insert a new version row (version_no += 1) and point the product at it.
  const { data: inserted, error: insErr } = await admin
    .from("product_versions")
    .insert({
      product_id: id,
      version_no: (version.version_no ?? 0) + 1,
      generated_json: next,
      notes: `Regenerated section: ${section}${notes ? ` — ${notes}` : ""}`,
      created_by: user.id,
    })
    .select("id, version_no")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to save new version" },
      { status: 500 },
    );
  }

  // Mirror surface fields back onto products so the admin panel + storefront
  // preview reflect the new value without having to re-join the version table.
  const patch: Record<string, unknown> = { current_version_id: inserted.id };
  if (section === "title") patch.title = next.title;
  if (section === "subtitle") patch.subtitle = next.subtitle;
  if (section === "description") patch.description = next.description;
  if (section === "outline") patch.outline = next.outline;
  if (section === "faq") patch.faq = next.faq;
  if (section === "call_to_action") patch.call_to_action = next.call_to_action;
  if (section === "tags") patch.tags = next.tags;

  await admin.from("products").update(patch).eq("id", id);

  return NextResponse.json({
    version_id: inserted.id,
    version_no: inserted.version_no,
    section,
    value: replaced,
  });
}
