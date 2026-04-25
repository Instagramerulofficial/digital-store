import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STATUSES = ["open", "dismissed", "applied"] as const;

/**
 * PATCH /api/admin/agent/suggestions
 * body: { id: string, status: "open" | "dismissed" | "applied" }
 */
export async function PATCH(request: Request) {
  await requireAdmin();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : null;
  const status = body.status;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof status !== "string" || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("agent_suggestions")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
