import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PostStatus } from "@/types/db";

export const runtime = "nodejs";

const ALLOWED_STATUSES: readonly PostStatus[] = [
  "draft",
  "approved",
  "scheduled",
  "posted",
  "failed",
  "archived",
] as const;

/**
 * PATCH /api/admin/agent/posts/[id]
 * body: { subject?, body?, media_url?, scheduled_at?, status? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (typeof body.subject === "string") patch.subject = body.subject;
  if (typeof body.body === "string") patch.body = body.body;
  if (typeof body.media_url === "string" || body.media_url === null)
    patch.media_url = body.media_url;
  if (body.scheduled_at === null) {
    patch.scheduled_at = null;
  } else if (typeof body.scheduled_at === "string") {
    const dt = new Date(body.scheduled_at);
    if (!Number.isFinite(dt.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled_at" },
        { status: 400 },
      );
    }
    patch.scheduled_at = dt.toISOString();
  }
  if (typeof body.status === "string") {
    if (!(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin
    .from("agent_posts")
    .update(patch)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("agent_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
