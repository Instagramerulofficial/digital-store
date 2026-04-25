import { Resend } from "resend";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  escapeTelegramHtml,
  isTelegramConfigured,
  sendChannelMessage,
  sendChannelPhoto,
} from "@/lib/telegram";
import type { AgentPost, Product } from "@/types/db";

export type DispatchResult =
  | { ok: true; external_id: string | null; recipients?: number }
  | { ok: false; error: string };

/* -------------------------------------------------------------
 * Telegram
 * ------------------------------------------------------------- */
export async function dispatchTelegram(
  post: AgentPost,
  product: Product | null,
): Promise<DispatchResult> {
  if (!isTelegramConfigured()) {
    return { ok: false, error: "Telegram is not configured" };
  }

  const productUrl = product ? `${env.siteUrl}/products/${product.slug}` : null;
  const textWithUrl = productUrl
    ? post.body.replace(/\{PRODUCT_URL\}/g, productUrl)
    : post.body.replace(/\s*\{PRODUCT_URL\}\s*/g, " ");
  const escaped = escapeTelegramHtml(textWithUrl);

  const button = productUrl
    ? { buttonText: "View product →", buttonUrl: productUrl }
    : {};

  const photo = post.media_url ?? product?.image_url ?? null;

  const res = photo
    ? await sendChannelPhoto({
        photoUrl: photo,
        caption: escaped,
        ...button,
      })
    : await sendChannelMessage({
        text: escaped,
        ...button,
      });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, external_id: String(res.result.message_id) };
}

/* -------------------------------------------------------------
 * Email newsletter (via Resend)
 * ------------------------------------------------------------- */
export async function dispatchEmailNewsletter(
  post: AgentPost,
  product: Product | null,
): Promise<DispatchResult> {
  if (!env.resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const admin = createSupabaseAdminClient();
  const { data: subs, error } = await admin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token")
    .is("unsubscribed_at", null);
  if (error) return { ok: false, error: error.message };

  const recipients = (subs ?? []) as {
    email: string;
    unsubscribe_token: string;
  }[];
  if (recipients.length === 0) {
    return { ok: true, external_id: null, recipients: 0 };
  }

  const subject =
    post.subject ||
    (product ? `New from Digital Store: ${product.title}` : "What's new");

  const productUrl = product
    ? `${env.siteUrl}/products/${product.slug}`
    : env.siteUrl;

  const resend = new Resend(env.resendApiKey);

  // Resend single-call with many recipients would leak addresses; we send
  // one email per subscriber so each gets a personalised unsubscribe link.
  // 2-concurrent loop keeps us well under Resend rate limits.
  let sent = 0;
  let firstError: string | null = null;
  await runInBatches(recipients, 2, async (s) => {
    const html = renderNewsletterHtml({
      bodyText: post.body,
      subject,
      productTitle: product?.title ?? null,
      productUrl,
      unsubscribeUrl: `${env.siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
        s.unsubscribe_token,
      )}`,
    });
    const { error } = await resend.emails.send({
      from: env.emailFrom,
      to: s.email,
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<${env.siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
          s.unsubscribe_token,
        )}>`,
      },
    });
    if (error) {
      if (!firstError) firstError = error.message ?? "send failed";
    } else {
      sent += 1;
    }
  });

  if (sent === 0 && firstError) return { ok: false, error: firstError };
  return { ok: true, external_id: null, recipients: sent };
}

/* -------------------------------------------------------------
 * Plain-channel dispatcher
 * ------------------------------------------------------------- */
export async function dispatchPost(
  post: AgentPost,
  product: Product | null,
): Promise<DispatchResult> {
  if (post.channel === "telegram") return dispatchTelegram(post, product);
  if (post.channel === "email") return dispatchEmailNewsletter(post, product);
  return {
    ok: false,
    error: `Channel "${post.channel}" is draft-only — copy manually`,
  };
}

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export function renderNewsletterHtml(args: {
  bodyText: string;
  subject: string;
  productTitle: string | null;
  productUrl: string;
  unsubscribeUrl: string;
}): string {
  const paragraphs = args.bodyText
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(p.trim())}</p>`)
    .join("");

  return `
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#111;background:#fff;">
  <div style="text-transform:uppercase;letter-spacing:2px;font-size:10px;color:#7c3aed;font-weight:700;margin-bottom:10px;">
    Digital Store newsletter
  </div>
  <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;">${escapeHtml(args.subject)}</h1>
  ${paragraphs}
  <div style="margin:22px 0;">
    <a href="${args.productUrl}"
       style="display:inline-block;padding:12px 18px;border-radius:8px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">
      ${escapeHtml(args.productTitle ?? "Open the store")}
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 14px;" />
  <p style="font-size:11px;color:#888;line-height:1.55;">
    You are receiving this because you subscribed at
    <a href="${env.siteUrl}" style="color:#7c3aed;">${new URL(env.siteUrl).host}</a>.
    <a href="${args.unsubscribeUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a>.
  </p>
</div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
