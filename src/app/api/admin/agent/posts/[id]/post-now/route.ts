import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchPost } from "@/lib/agent/channels";
import type { AgentPost, Product } from "@/types/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/agent/posts/[id]/post-now
 * Dispatches a single post immediately via its channel.
 * Marks the row as posted / failed.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: post, error: postErr } = await admin
    .from("agent_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  const typedPost = post as AgentPost;

  let product: Product | null = null;
  if (typedPost.product_id) {
    const { data } = await admin
      .from("products")
      .select("*")
      .eq("id", typedPost.product_id)
      .maybeSingle();
    product = (data as Product | null) ?? null;
  }

  const res = await dispatchPost(typedPost, product);

  if (res.ok) {
    await admin
      .from("agent_posts")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        external_id: res.external_id,
        error: null,
        meta: {
          ...typedPost.meta,
          recipients: res.recipients,
        },
      })
      .eq("id", id);
    return NextResponse.json({
      ok: true,
      external_id: res.external_id,
      recipients: res.recipients,
    });
  } else {
    await admin
      .from("agent_posts")
      .update({
        status: "failed",
        error: res.error,
      })
      .eq("id", id);
    return NextResponse.json({ error: res.error }, { status: 502 });
  }
}
