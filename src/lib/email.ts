import { Resend } from "resend";
import { env } from "@/lib/env";

type DownloadLink = { title: string; url: string };

type SendReceiptArgs = {
  to: string;
  orderId: string;
  totalCents: number;
  currency: string;
  downloads: DownloadLink[];
};

/**
 * Sends a purchase confirmation email.
 * If RESEND_API_KEY is not configured, logs a warning and returns
 * { skipped: true } so local dev still works without Resend.
 */
export async function sendOrderReceiptEmail(args: SendReceiptArgs) {
  if (!env.resendApiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set - skipping receipt for order ${args.orderId}`,
    );
    return { skipped: true as const };
  }

  const resend = new Resend(env.resendApiKey);
  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: args.currency.toUpperCase(),
  }).format(args.totalCents / 100);

  const downloadsHtml = args.downloads
    .map(
      (d) =>
        `<li style="margin:8px 0;"><a href="${d.url}" style="color:#7c3aed;text-decoration:none;">${escapeHtml(d.title)}</a></li>`,
    )
    .join("");

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;background:#fff;">
      <h1 style="margin:0 0 8px;font-size:22px;">Thanks for your purchase 🎉</h1>
      <p style="color:#555;">
        Order <strong>${args.orderId}</strong> — Total <strong>${total}</strong>
      </p>
      <h2 style="font-size:16px;margin-top:24px;">Your downloads</h2>
      <ul style="padding-left:18px;">${downloadsHtml}</ul>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        These links are personal and valid for <strong>24 hours</strong>.
        After that, sign in to your dashboard to generate fresh ones:
        <a href="${env.siteUrl}/dashboard" style="color:#7c3aed;">${env.siteUrl}/dashboard</a>.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: args.to,
    subject: `Your Digital Store order ${args.orderId}`,
    html,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { ok: false as const, error };
  }
  return { ok: true as const };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
