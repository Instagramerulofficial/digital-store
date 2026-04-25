import { Bot, Users, Lightbulb, Send } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type {
  AgentPost,
  AgentSuggestion,
  NewsletterSubscriber,
} from "@/types/db";
import AgentDashboard from "./AgentDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing agent" };

export default async function AdminAgentPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [postsRes, subsRes, suggRes, productsRes, activeSubsCount] =
    await Promise.all([
      admin
        .from("agent_posts")
        .select("*, product:products(id,title,slug)")
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("agent_suggestions")
        .select("*, product:products(id,title,slug)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("products")
        .select("id, title")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .is("unsubscribed_at", null),
    ]);

  const posts = (postsRes.data ?? []) as (AgentPost & {
    product: { id: string; title: string; slug: string } | null;
  })[];
  const subs = (subsRes.data ?? []) as NewsletterSubscriber[];
  const suggestions = (suggRes.data ?? []) as (AgentSuggestion & {
    product: { id: string; title: string; slug: string } | null;
  })[];
  const products = (productsRes.data ?? []) as { id: string; title: string }[];

  const activeCount = activeSubsCount.count ?? 0;

  const telegramOk = Boolean(env.telegramBotToken && env.telegramChannelId);
  const resendOk = Boolean(env.resendApiKey);
  const openaiOk = Boolean(env.openaiApiKey);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <header className="flex items-start gap-3 mb-6">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
        >
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Marketing agent</h1>
          <p className="muted text-sm mt-1 max-w-2xl">
            Drafts posts for each product, sends email newsletters, posts to
            Telegram, recovers abandoned carts, and flags low-performing
            products. You approve — the agent executes.
          </p>
        </div>
      </header>

      {/* Config banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatusCard
          icon={<Send className="h-4 w-4" />}
          label="OpenAI"
          ok={openaiOk}
          hint={openaiOk ? "Connected" : "Set OPENAI_API_KEY"}
        />
        <StatusCard
          icon={<Send className="h-4 w-4" />}
          label="Telegram"
          ok={telegramOk}
          hint={
            telegramOk
              ? "Bot + channel configured"
              : "Set TELEGRAM_BOT_TOKEN + CHANNEL_ID"
          }
        />
        <StatusCard
          icon={<Users className="h-4 w-4" />}
          label="Email (Resend)"
          ok={resendOk}
          hint={resendOk ? `${activeCount} subscriber(s)` : "Set RESEND_API_KEY"}
        />
      </div>

      <AgentDashboard
        posts={posts}
        subscribers={subs}
        suggestions={suggestions}
        products={products}
        activeSubscribers={activeCount}
      />

      <p className="muted text-xs mt-8">
        <Lightbulb className="inline h-3 w-3 mr-1" />
        Cron: GET <code>/api/cron/agent</code> with header{" "}
        <code>Authorization: Bearer $CRON_SECRET</code>. Run it hourly (Vercel
        Cron, cron-job.org, GitHub Actions, etc.) to post scheduled content
        and send recovery emails.
      </p>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  ok,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: ok ? "rgb(34 197 94 / 0.15)" : "rgb(156 163 175 / 0.15)",
          color: ok ? "rgb(21 128 61)" : "rgb(75 85 99)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="muted text-xs truncate">{hint}</div>
      </div>
      <span
        className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
        style={{
          background: ok ? "rgb(34 197 94 / 0.15)" : "rgb(156 163 175 / 0.15)",
          color: ok ? "rgb(21 128 61)" : "rgb(75 85 99)",
        }}
      >
        {ok ? "READY" : "OFF"}
      </span>
    </div>
  );
}
