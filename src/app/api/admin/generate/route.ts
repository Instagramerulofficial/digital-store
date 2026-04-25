import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateProduct } from "@/lib/ai/openai";
import { slugify } from "@/lib/utils";
import {
  PRODUCT_TYPES,
  type GenerationInput,
  type ProductType,
  type Tone,
} from "@/types/db";

export const runtime = "nodejs";
export const maxDuration = 120; // AI call can take a while

const ALLOWED_TONES: readonly Tone[] = [
  "expert",
  "friendly",
  "concise",
  "playful",
  "motivational",
  "neutral",
] as const;

export async function POST(request: Request) {
  const user = await requireAdmin();
  const admin = createSupabaseAdminClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseInput(body);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  let generated;
  try {
    generated = await generateProduct(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    console.error("[admin/generate] AI failed:", err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Look up category by slug (optional).
  const { data: cat } = await admin
    .from("categories")
    .select("id, slug, name")
    .eq("slug", generated.category_slug)
    .maybeSingle();

  const slug = `${slugify(generated.title)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // Clamp suggested price inside the requested range
  const [minC, maxC] = input.price_range_cents;
  const priceCents = Math.min(
    Math.max(generated.suggested_price_cents, minC),
    maxC,
  );

  // 1. Insert the product draft (not published yet; file is placeholder).
  const { data: product, error: prodErr } = await admin
    .from("products")
    .insert({
      slug,
      title: generated.title,
      subtitle: generated.subtitle,
      description: generated.description,
      price_cents: priceCents,
      currency: "usd",
      image_url: null,
      file_path: "pending",
      file_name: "",
      file_size_bytes: 0,
      category: cat?.name ?? null,
      category_id: cat?.id ?? null,
      is_published: false,
      product_type: input.product_type,
      outline: generated.outline,
      faq: generated.faq,
      tags: generated.tags,
      call_to_action: generated.call_to_action,
      generation_prompt: input,
    })
    .select("id, slug")
    .single();
  if (prodErr || !product) {
    console.error("[admin/generate] insert product failed:", prodErr);
    return NextResponse.json(
      { error: prodErr?.message ?? "Failed to create product" },
      { status: 500 },
    );
  }

  // 2. Insert the first version.
  const { data: version, error: versionErr } = await admin
    .from("product_versions")
    .insert({
      product_id: product.id,
      version_no: 1,
      generated_json: generated,
      notes: "Initial AI generation",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionErr || !version) {
    console.error("[admin/generate] insert version failed:", versionErr);
    return NextResponse.json(
      { error: versionErr?.message ?? "Failed to save version" },
      { status: 500 },
    );
  }

  // 3. Link product to its current version.
  await admin
    .from("products")
    .update({ current_version_id: version.id })
    .eq("id", product.id);

  return NextResponse.json({
    product_id: product.id,
    slug: product.slug,
    version_id: version.id,
  });
}

/* -------------------------------------------------------------
 * Input validation
 * ------------------------------------------------------------- */
function parseInput(
  raw: unknown,
): GenerationInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid body" };
  const r = raw as Record<string, unknown>;

  const topic = str(r.topic);
  const niche = str(r.niche);
  const audience = str(r.audience);
  const product_type = r.product_type as ProductType;
  const tone = (r.tone as Tone) ?? "neutral";
  const extra = typeof r.extra_instructions === "string"
    ? r.extra_instructions.trim()
    : undefined;

  if (!topic) return { error: "Topic is required" };
  if (!niche) return { error: "Niche is required" };
  if (!audience) return { error: "Audience is required" };
  if (!PRODUCT_TYPES.includes(product_type)) {
    return { error: "Invalid product_type" };
  }
  if (!ALLOWED_TONES.includes(tone)) return { error: "Invalid tone" };

  const range = r.price_range_cents;
  if (!Array.isArray(range) || range.length !== 2) {
    return { error: "price_range_cents must be [min, max]" };
  }
  const min = Math.round(Number(range[0]));
  const max = Math.round(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return { error: "Invalid price range" };
  }

  return {
    topic,
    niche,
    audience,
    tone,
    product_type,
    price_range_cents: [min, max],
    extra_instructions: extra,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
