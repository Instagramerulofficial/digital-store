/**
 * Centralized environment variable access.
 * Throws clear, actionable errors when required values are missing.
 */

function read(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

export const env = {
  siteUrl:
    read("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "") || "http://localhost:3000",

  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseBucket: read("SUPABASE_PRODUCTS_BUCKET", "products"),

  stripeSecret: read("STRIPE_SECRET_KEY"),
  stripePublishable: read("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
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
