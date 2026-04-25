import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePostsForProduct } from "@/lib/agent/generator";
import {
  POST_CHANNELS,
  type PostChannel,
  type Product,
} from "@/types/db";

export const runtime = "nodejs";
// Hobby plan caps at 60s; raise to 120 on Pro.
export const maxDuration = 60;

/**
 * POST /api/admin/agent/generate
 * body: { product_id: string, channels?: PostChannel[], overwrite?: boolean }
 *
 * Generates one draft per requested channel and inserts into `agent_posts`.
 * If `overwrite=false` (default) existing *draft* rows for the same
 * (product, channel) are archived first so the admin doesn't accumulate junk.
 */
export async function POST(request: Request) {
  const user = await requireAdmin();
  const admin = createSupabaseAdminClient();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productId =
    typeof body.product_id === "string" ? body.product_id : null;
  if (!productId) {
    return NextResponse.json(
      { error: "product_id is required" },
      { status: 400 },
    );
  }

  const channels = pickChannels(body.channels);

  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Archive any previous *drafts* for these channels so we don't duplicate.
  await admin
    .from("agent_posts")
    .update({ status: "archived" })
    .eq("product_id", productId)
    .eq("status", "draft")
    .in("channel", channels);

  const results = await generatePostsForProduct(
    product as Product,
    channels,
  );

  const rows = results
    .filter((r) => r.post)
    .map((r) => ({
      product_id: productId,
      channel: r.channel,
      status: "draft" as const,
      subject: r.post!.subject,
      body: r.post!.body,
      media_url: r.post!.media_url,
      created_by: user.id,
    }));

  let inserted: { id: string; channel: PostChannel }[] = [];
  if (rows.length > 0) {
    const { data, error } = await admin
      .from("agent_posts")
      .insert(rows)
      .select("id, channel");
    if (error) {
      console.error("[agent/generate] insert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted = (data ?? []) as { id: string; channel: PostChannel }[];
  }

  return NextResponse.json({
    inserted,
    errors: results
      .filter((r) => r.error)
      .map((r) => ({ channel: r.channel, error: r.error })),
  });
}

function pickChannels(raw: unknown): PostChannel[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...POST_CHANNELS];
  }
  const set = new Set<PostChannel>();
  for (const v of raw) {
    if (typeof v === "string" && (POST_CHANNELS as readonly string[]).includes(v)) {
      set.add(v as PostChannel);
    }
  }
  return set.size === 0 ? [...POST_CHANNELS] : [...set];
}
