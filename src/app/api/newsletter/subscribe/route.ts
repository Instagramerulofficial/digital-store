import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/newsletter/subscribe
 * body: { email: string, source?: string }
 * Idempotent on `email` — returns ok for duplicates without re-inserting.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 64) : null;

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // Attach user_id if signed in (nice analytics).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createSupabaseAdminClient();

  // Check if already subscribed (and re-activate if they once unsubscribed).
  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.unsubscribed_at) {
      await admin
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: null })
        .eq("id", existing.id);
    }
    return NextResponse.json({ ok: true, resubscribed: !!existing.unsubscribed_at });
  }

  const { error } = await admin.from("newsletter_subscribers").insert({
    email,
    source,
    user_id: user?.id ?? null,
  });
  if (error) {
    console.error("[newsletter/subscribe] insert failed:", error);
    return NextResponse.json({ error: "Could not subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
