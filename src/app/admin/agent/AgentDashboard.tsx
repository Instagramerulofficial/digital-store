"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Copy,
  Loader2,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/components/Toaster";
import {
  AUTO_POST_CHANNELS,
  POST_CHANNEL_LABELS,
  type AgentPost,
  type AgentSuggestion,
  type NewsletterSubscriber,
  type PostChannel,
  type PostStatus,
} from "@/types/db";

type PostRow = AgentPost & {
  product: { id: string; title: string; slug: string } | null;
};
type SuggestionRow = AgentSuggestion & {
  product: { id: string; title: string; slug: string } | null;
};

type Tab = "queue" | "history" | "subscribers" | "suggestions";

export default function AgentDashboard({
  posts,
  subscribers,
  suggestions,
  products,
  activeSubscribers,
}: {
  posts: PostRow[];
  subscribers: NewsletterSubscriber[];
  suggestions: SuggestionRow[];
  products: { id: string; title: string }[];
  activeSubscribers: number;
}) {
  const [tab, setTab] = useState<Tab>("queue");

  const queuePosts = useMemo(
    () =>
      posts.filter((p) =>
        (["draft", "approved", "scheduled", "failed"] as PostStatus[]).includes(
          p.status,
        ),
      ),
    [posts],
  );
  const historyPosts = useMemo(
    () => posts.filter((p) => p.status === "posted"),
    [posts],
  );

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap border-b mb-5"
           style={{ borderColor: "rgb(var(--border))" }}>
        <TabButton
          active={tab === "queue"}
          onClick={() => setTab("queue")}
          label={`Queue (${queuePosts.length})`}
        />
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          label={`Posted (${historyPosts.length})`}
        />
        <TabButton
          active={tab === "subscribers"}
          onClick={() => setTab("subscribers")}
          label={`Subscribers (${activeSubscribers})`}
        />
        <TabButton
          active={tab === "suggestions"}
          onClick={() => setTab("suggestions")}
          label={`Suggestions (${suggestions.length})`}
        />

        <div className="ml-auto">
          <GenerateForProduct products={products} />
        </div>
      </div>

      {tab === "queue" && <QueueTab posts={queuePosts} />}
      {tab === "history" && <HistoryTab posts={historyPosts} />}
      {tab === "subscribers" && <SubscribersTab subscribers={subscribers} />}
      {tab === "suggestions" && <SuggestionsTab suggestions={suggestions} />}
    </div>
  );
}

/* -------------------------------------------------------------
 * Tab header
 * ------------------------------------------------------------- */
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
      style={{
        borderColor: active ? "rgb(124 58 237)" : "transparent",
        color: active ? "rgb(124 58 237)" : "rgb(var(--muted))",
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------
 * "Generate for product" launcher
 * ------------------------------------------------------------- */
function GenerateForProduct({
  products,
}: {
  products: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState<string>(products[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!pid) return;
    setBusy(true);
    const res = await fetch("/api/admin/agent/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: pid }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(j.error ?? "Generation failed", "error");
      return;
    }
    toast(`Generated ${j.inserted?.length ?? 0} drafts`, "success");
    setOpen(false);
    router.refresh();
  }

  if (products.length === 0) {
    return <p className="muted text-xs">Publish a product first.</p>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4" /> Generate drafts
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title="Generate marketing drafts">
          <p className="muted text-sm mb-3">
            Creates a fresh draft for every channel (Telegram, Email,
            Twitter, LinkedIn, Reddit). Existing draft posts for this
            product are archived.
          </p>
          <label className="block">
            <span className="text-sm font-medium">Product</span>
            <select
              className="input w-full mt-1"
              value={pid}
              onChange={(e) => setPid(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setOpen(false)} className="btn-ghost">
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={busy || !pid}
              className="btn-primary inline-flex items-center gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -------------------------------------------------------------
 * Queue tab (drafts + approved + scheduled + failed)
 * ------------------------------------------------------------- */
function QueueTab({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">
          Nothing in the queue. Click <strong>Generate drafts</strong> or
          publish a product to auto-create marketing posts.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function HistoryTab({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">No posted posts yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} compact />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
 * Individual post row
 * ------------------------------------------------------------- */
function PostCard({ post, compact = false }: { post: PostRow; compact?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState(post.body);
  const [subject, setSubject] = useState(post.subject ?? "");
  const [schedule, setSchedule] = useState(post.scheduled_at ?? "");
  const [busy, setBusy] = useState<null | "save" | "approve" | "post" | "delete">(
    null,
  );

  const isAuto = (AUTO_POST_CHANNELS as readonly string[]).includes(post.channel);
  const dirty = body !== post.body || subject !== (post.subject ?? "") || schedule !== (post.scheduled_at ?? "");

  async function patch(payload: Record<string, unknown>, message: string, kind: "save" | "approve") {
    setBusy(kind);
    const res = await fetch(`/api/admin/agent/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(j.error ?? "Failed", "error");
      return false;
    }
    toast(message, "success");
    router.refresh();
    return true;
  }

  async function save() {
    await patch(
      {
        body,
        subject: subject || null,
        scheduled_at: schedule || null,
      },
      "Saved",
      "save",
    );
  }

  async function approve() {
    const status: PostStatus = schedule ? "scheduled" : "approved";
    await patch(
      {
        body,
        subject: subject || null,
        scheduled_at: schedule || null,
        status,
      },
      schedule ? "Scheduled" : "Approved",
      "approve",
    );
  }

  async function postNow() {
    setBusy("post");
    const res = await fetch(`/api/admin/agent/posts/${post.id}/post-now`, {
      method: "POST",
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast(j.error ?? "Post failed", "error");
      return;
    }
    const tail = typeof j.recipients === "number" ? ` (${j.recipients} recipients)` : "";
    toast(`Posted to ${POST_CHANNEL_LABELS[post.channel]}${tail}`, "success");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this draft?")) return;
    setBusy("delete");
    const res = await fetch(`/api/admin/agent/posts/${post.id}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!res.ok) {
      toast("Delete failed", "error");
      return;
    }
    toast("Deleted", "success");
    router.refresh();
  }

  function copy() {
    const text = subject ? `${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text).then(
      () => toast("Copied to clipboard", "success"),
      () => toast("Copy failed", "error"),
    );
  }

  return (
    <div className="card p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: isAuto
                  ? "rgb(124 58 237 / 0.12)"
                  : "rgb(156 163 175 / 0.15)",
                color: isAuto ? "rgb(124 58 237)" : "rgb(75 85 99)",
              }}
            >
              {POST_CHANNEL_LABELS[post.channel]}
            </span>
            <StatusPill status={post.status} />
            {!isAuto ? (
              <span className="muted text-[10px]">copy-paste only</span>
            ) : null}
          </div>
          {post.product ? (
            <Link
              href={`/products/${post.product.slug}`}
              target="_blank"
              className="text-sm font-medium mt-1 hover:underline truncate block"
            >
              {post.product.title}
            </Link>
          ) : null}
          {post.error ? (
            <p className="text-xs text-red-600 mt-1">Error: {post.error}</p>
          ) : null}
          {post.posted_at ? (
            <p className="muted text-xs mt-1">
              Posted {new Date(post.posted_at).toLocaleString()}
              {post.external_id ? ` · id ${post.external_id}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={copy} className="btn-ghost" title="Copy">
            <Copy className="h-4 w-4" />
          </button>
          {!compact ? (
            <button
              onClick={remove}
              disabled={busy !== null}
              className="btn-ghost text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {(post.channel === "email" || post.channel === "reddit") && !compact ? (
        <input
          className="input w-full mb-2"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      ) : null}

      <textarea
        className="input w-full font-mono text-xs"
        rows={compact ? 4 : 8}
        value={body}
        readOnly={compact}
        onChange={(e) => setBody(e.target.value)}
      />

      {!compact ? (
        <>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs muted">
              <CalendarClock className="h-3 w-3" /> Schedule
              <input
                type="datetime-local"
                className="input text-xs py-1"
                value={schedule ? schedule.slice(0, 16) : ""}
                onChange={(e) =>
                  setSchedule(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )
                }
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={save}
                disabled={busy !== null || !dirty}
                className="btn-ghost inline-flex items-center gap-1 text-sm disabled:opacity-40"
              >
                {busy === "save" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                Save
              </button>
              <button
                onClick={approve}
                disabled={busy !== null}
                className="btn-ghost inline-flex items-center gap-1 text-sm"
              >
                {busy === "approve" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {schedule ? "Schedule" : "Approve"}
              </button>
              {isAuto ? (
                <button
                  onClick={postNow}
                  disabled={busy !== null}
                  className="btn-primary inline-flex items-center gap-1 text-sm"
                >
                  {busy === "post" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Post now
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: PostStatus }) {
  const styles: Record<PostStatus, { bg: string; fg: string }> = {
    draft: { bg: "rgb(156 163 175 / 0.18)", fg: "rgb(75 85 99)" },
    approved: { bg: "rgb(59 130 246 / 0.15)", fg: "rgb(29 78 216)" },
    scheduled: { bg: "rgb(234 179 8 / 0.18)", fg: "rgb(161 98 7)" },
    posted: { bg: "rgb(34 197 94 / 0.15)", fg: "rgb(21 128 61)" },
    failed: { bg: "rgb(239 68 68 / 0.15)", fg: "rgb(185 28 28)" },
    archived: { bg: "rgb(156 163 175 / 0.15)", fg: "rgb(75 85 99)" },
  };
  const s = styles[status];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  );
}

/* -------------------------------------------------------------
 * Subscribers tab
 * ------------------------------------------------------------- */
function SubscribersTab({
  subscribers,
}: {
  subscribers: NewsletterSubscriber[];
}) {
  if (subscribers.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">
          No newsletter subscribers yet. Add the signup widget to your
          landing page — it&apos;s already rendered on the home page.
        </p>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead
          className="text-left"
          style={{ background: "rgb(var(--border) / 0.25)" }}
        >
          <tr>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Subscribed</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr
              key={s.id}
              className="border-t"
              style={{ borderColor: "rgb(var(--border))" }}
            >
              <td className="px-4 py-2 font-mono text-xs">{s.email}</td>
              <td className="px-4 py-2 muted text-xs">{s.source ?? "—"}</td>
              <td className="px-4 py-2 muted text-xs">
                {new Date(s.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-2">
                {s.unsubscribed_at ? (
                  <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                    <X className="h-3 w-3" /> Unsubscribed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                    <Check className="h-3 w-3" /> Active
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------
 * Suggestions tab
 * ------------------------------------------------------------- */
function SuggestionsTab({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "dismissed" | "applied") {
    setBusy(id);
    const admin = await fetch("/api/admin/agent/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(null);
    if (!admin.ok) {
      toast("Failed", "error");
      return;
    }
    toast("Updated", "success");
    router.refresh();
  }

  if (suggestions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="muted">
          No suggestions. The agent scans for low-performing products every
          cron run (hourly) after 14 days without sales.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div key={s.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgb(234 179 8 / 0.18)",
                    color: "rgb(161 98 7)",
                  }}
                >
                  {s.kind.replace(/_/g, " ")}
                </span>
                {s.product ? (
                  <Link
                    href={`/admin/products/${s.product.id}/edit`}
                    className="text-sm font-medium hover:underline"
                  >
                    {s.product.title}
                  </Link>
                ) : null}
              </div>
              <p className="text-sm">{s.message}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {s.product ? (
                <Link
                  href={`/admin/products/${s.product.id}/edit`}
                  className="btn-primary text-xs inline-flex items-center gap-1"
                >
                  <RefreshCcw className="h-3 w-3" /> Fix
                </Link>
              ) : null}
              <button
                onClick={() => setStatus(s.id, "dismissed")}
                disabled={busy === s.id}
                className="btn-ghost text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
 * Simple modal
 * ------------------------------------------------------------- */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.45)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-lg p-5 mt-10 sm:mt-0"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-ghost" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
