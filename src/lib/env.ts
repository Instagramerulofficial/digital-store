/**
 * Centralized environment variable access.
 *
 * IMPORTANT — about NEXT_PUBLIC_* vars:
 * Next.js inlines `process.env.NEXT_PUBLIC_*` into the client bundle ONLY when
 * the reference is a *static* member access. A dynamic lookup like
 * `process.env[name]` is opaque to webpack's static analysis and is left as a
 * runtime read against an empty `process.env` in the browser. Anything that
 * any Client Component might read (directly or transitively) MUST therefore
 * use the static form below — otherwise the browser sees an empty string.
 *
 * Server-only vars (no NEXT_PUBLIC_ prefix) keep using the small `read()`
 * helper because they only run in Node, where `process.env` is fully
 * populated by Next from `.env.local` / the host environment.
 */

function read(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PUBLIC_STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const env = {
  siteUrl: PUBLIC_SITE_URL.replace(/\/$/, "") || "http://localhost:3000",

  supabaseUrl: PUBLIC_SUPABASE_URL,
  supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseBucket: read("SUPABASE_PRODUCTS_BUCKET", "products"),

  stripeSecret: read("STRIPE_SECRET_KEY"),
  stripePublishable: PUBLIC_STRIPE_PUBLISHABLE_KEY,
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),

  resendApiKey: read("RESEND_API_KEY"),
  emailFrom: read("EMAIL_FROM", "Digital Store <noreply@example.com>"),

  adminEmails: read("ADMIN_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  openaiApiKey: read("OPENAI_API_KEY"),
  openaiModel: read("OPENAI_MODEL", "gpt-4o-mini"),

  telegramBotToken: read("TELEGRAM_BOT_TOKEN"),
  telegramChannelId: read("TELEGRAM_CHANNEL_ID"),

  cronSecret: read("CRON_SECRET"),
};

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminEmails.includes(email.toLowerCase());
}
