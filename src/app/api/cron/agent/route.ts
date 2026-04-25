import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchPost } from "@/lib/agent/channels";
import { Resend } from "resend";
import type {
  AbandonedCheckout,
  AgentPost,
  Product,
} from "@/types/db";

export const runtime = "nodejs";
// Vercel Hobby plan caps serverless functions at 60s.
// On Pro this can safely go up to 300.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/agent
 *
 * Protected by `CRON_SECRET`. Expected header:
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * On each run:
 *   1. Post all `approved` posts whose scheduled_at is in the past
 *      (or scheduled_at IS NULL).
 *   2. Send abandoned-cart recovery emails (pending checkouts > 24h old).
 *   3. Insert `agent_suggestions` for products with no sales after 14 days.
 *
 * Safe to run hourly.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    posts_dispatched: 0,
    posts_failed: 0,
    recovery_emails_sent: 0,
    suggestions_created: 0,
  };

  try {
    summary.posts_dispatched += await runScheduledPosts(summary);
    summary.recovery_emails_sent += await runAbandonedCarts();
    summary.suggestions_created += await runLowPerformerScan();
  } catch (err) {
    console.error("[cron/agent] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed", summary },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, summary });
}

/* -------------------------------------------------------------
 * 1. Scheduled posts
 * ------------------------------------------------------------- */
async function runScheduledPosts(
  summary: { posts_failed: number },
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: dueRaw } = await admin
    .from("agent_posts")
    .select("*")
    .eq("status", "approved")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .in("channel", ["telegram", "email"])
    .order("created_at", { ascending: true })
    .limit(20);

  const due = (dueRaw ?? []) as AgentPost[];
  if (due.length === 0) return 0;

  // Preload products in one query.
  const productIds = Array.from(
    new Set(due.map((p) => p.product_id).filter((id): id is string => !!id)),
  );
  let productsById = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: prods } = await admin
      .from("products")
      .select("*")
      .in("id", productIds);
    productsById = new Map(
      ((prods as Product[] | null) ?? []).map((p) => [p.id, p]),
    );
  }

  let sent = 0;
  for (const post of due) {
    const product = post.product_id
      ? (productsById.get(post.product_id) ?? null)
      : null;
    const res = await dispatchPost(post, product);
    if (res.ok) {
      await admin
        .from("agent_posts")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          external_id: res.external_id,
          error: null,
          meta: { ...post.meta, recipients: res.recipients },
        })
        .eq("id", post.id);
      sent += 1;
    } else {
      await admin
        .from("agent_posts")
        .update({ status: "failed", error: res.error })
        .eq("id", post.id);
      summary.posts_failed += 1;
    }
  }
  return sent;
}

/* -------------------------------------------------------------
 * 2. Abandoned-cart recovery (>= 24h pending checkouts)
 * ------------------------------------------------------------- */
async function runAbandonedCarts(): Promise<number> {
  if (!env.resendApiKey) return 0;

  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await admin
    .from("abandoned_checkouts")
    .select("*")
    .eq("status", "pending")
    .is("recovery_email_sent_at", null)
    .lte("created_at", cutoff)
    .not("email", "is", null)
    .limit(50);

  const list = (rows ?? []) as AbandonedCheckout[];
  if (list.length === 0) return 0;

  // Collect product titles for nicer emails.
  const productIds = Array.from(
    new Set(list.flatMap((r) => r.product_ids ?? [])),
  );
  let titlesById = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: prods } = await admin
      .from("products")
      .select("id, title")
      .in("id", productIds);
    titlesById = new Map(
      ((prods as { id: string; title: string }[] | null) ?? []).map(
        (p) => [p.id, p.title],
      ),
    );
  }

  const resend = new Resend(env.resendApiKey);
  let sent = 0;

  for (const row of list) {
    if (!row.email) continue;
    const titles = (row.product_ids ?? [])
      .map((id) => titlesById.get(id))
      .filter(Boolean) as string[];
    const listHtml = titles
      .map((t) => `<li>${escapeHtml(t)}</li>`)
      .join("");

    const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#111;background:#fff;">
  <h1 style="margin:0 0 12px;font-size:22px;">You left something behind 🛒</h1>
  <p style="color:#555;line-height:1.55;">
    Your cart is still saved. Ready to finish the checkout?
  </p>
  ${titles.length ? `<ul style="padding-left:18px;">${listHtml}</ul>` : ""}
  <div style="margin:22px 0;">
    <a href="${env.siteUrl}/cart" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">
      Return to checkout
    </a>
  </div>
  <p style="color:#888;font-size:12px;">If you already purchased, ignore this message.</p>
</div>`;
    const { error } = await resend.emails.send({
      from: env.emailFrom,
      to: row.email,
      subject: "You left something in your cart",
      html,
    });
    await admin
      .from("abandoned_checkouts")
      .update({ recovery_email_sent_at: new Date().toISOString() })
      .eq("id", row.id);
    if (!error) sent += 1;
  }

  return sent;
}

/* -------------------------------------------------------------
 * 3. Low-performer scan — products published >= 14d ago with 0 sales
 * ------------------------------------------------------------- */
async function runLowPerformerScan(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: products } = await admin
    .from("products")
    .select("id, title, product_type, created_at")
    .eq("is_published", true)
    .lte("created_at", cutoff);

  const list = (products as { id: string; title: string; created_at: string }[] | null) ?? [];
  if (list.length === 0) return 0;

  const ids = list.map((p) => p.id);
  const { data: purchases } = await admin
    .from("purchases")
    .select("product_id")
    .in("product_id", ids);
  const soldIds = new Set(
    ((purchases as { product_id: string }[] | null) ?? []).map((p) => p.product_id),
  );

  const losers = list.filter((p) => !soldIds.has(p.id));
  if (losers.length === 0) return 0;

  // Skip products that already have an open suggestion.
  const { data: existing } = await admin
    .from("agent_suggestions")
    .select("product_id")
    .eq("status", "open")
    .in("product_id", losers.map((l) => l.id));
  const existingSet = new Set(
    ((existing as { product_id: string | null }[] | null) ?? [])
      .map((r) => r.product_id)
      .filter((v): v is string => !!v),
  );

  const rows = losers
    .filter((p) => !existingSet.has(p.id))
    .map((p) => ({
      product_id: p.id,
      kind: "low_sales" as const,
      status: "open" as const,
      message: `"${p.title}" has been published for 14+ days with no sales. Consider regenerating the description, adjusting the price, or running a marketing push.`,
      meta: { published_at: p.created_at },
    }));

  if (rows.length === 0) return 0;

  const { error } = await admin.from("agent_suggestions").insert(rows);
  if (error) {
    console.error("[cron/agent] suggestion insert failed:", error);
    return 0;
  }
  return rows.length;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
