"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Rocket,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/components/Toaster";
import type {
  AiGeneratedProduct,
  Product,
  ProductType,
} from "@/types/db";
import { PRODUCT_TYPE_LABELS } from "@/types/db";
import type { VersionSummary } from "./page";

type SectionKey =
  | "title"
  | "subtitle"
  | "description"
  | "outline"
  | "content"
  | "faq"
  | "call_to_action"
  | "tags";

export default function EditProductForm({
  product,
  current,
  versions,
}: {
  product: Product;
  current: AiGeneratedProduct | null;
  versions: VersionSummary[];
}) {
  const router = useRouter();

  const [priceDollars, setPriceDollars] = useState(
    (product.price_cents / 100).toFixed(2),
  );
  const [title, setTitle] = useState(product.title);
  const [subtitle, setSubtitle] = useState(product.subtitle ?? "");
  const [description, setDescription] = useState(product.description);
  const [cta, setCta] = useState(product.call_to_action ?? "");
  const [tags, setTags] = useState((product.tags ?? []).join(", "));
  const [savingMeta, setSavingMeta] = useState(false);

  const [regenBusy, setRegenBusy] = useState<SectionKey | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  const typeLabel = product.product_type
    ? PRODUCT_TYPE_LABELS[product.product_type as ProductType]
    : "Unknown";

  async function saveMeta() {
    setSavingMeta(true);
    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setSavingMeta(false);
      toast("Invalid price", "error");
      return;
    }

    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        title,
        description,
        price_cents: priceCents,
      }),
    });
    setSavingMeta(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error ?? "Save failed", "error");
      return;
    }
    toast("Saved", "success");
    router.refresh();
  }

  async function regenerate(section: SectionKey) {
    if (regenBusy) return;
    setRegenBusy(section);
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error ?? "Regeneration failed", "error");
      } else {
        toast(`Regenerated: ${section}`, "success");
        router.refresh();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Network error", "error");
    } finally {
      setRegenBusy(null);
    }
  }

  async function publish() {
    if (publishBusy) return;
    setPublishBusy(true);
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/publish`,
        { method: "POST" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error ?? "Publish failed", "error");
      } else {
        toast("Published — PDF generated", "success");
        router.refresh();
      }
    } finally {
      setPublishBusy(false);
    }
  }

  async function unpublish() {
    if (publishBusy) return;
    setPublishBusy(true);
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/publish`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast(j.error ?? "Failed", "error");
      } else {
        toast("Unpublished", "success");
        router.refresh();
      }
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* LEFT: content */}
      <div className="space-y-6 min-w-0">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="muted text-xs uppercase tracking-wider">
                {typeLabel}
              </p>
              <h1 className="text-xl font-bold mt-1">
                {product.title || "(untitled)"}
              </h1>
              {product.subtitle ? (
                <p className="muted text-sm mt-1">{product.subtitle}</p>
              ) : null}
            </div>
            <span
              className="shrink-0 text-xs font-medium px-2 py-1 rounded-full"
              style={{
                background: product.is_published
                  ? "rgb(34 197 94 / 0.15)"
                  : "rgb(156 163 175 / 0.15)",
                color: product.is_published
                  ? "rgb(21 128 61)"
                  : "rgb(75 85 99)",
              }}
            >
              {product.is_published ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        {/* Editable metadata */}
        <Section
          title="Metadata"
          description="Core fields. Edits here override the AI version and are saved directly."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title">
              <input
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Subtitle">
              <input
                className="input w-full"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </Field>
            <Field label="Price ($)">
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
              />
            </Field>
            <Field label="Call to action">
              <input
                className="input w-full"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                className="input w-full"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Description / sales copy">
            <textarea
              className="input w-full"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <button
              onClick={saveMeta}
              className="btn-primary inline-flex items-center gap-2"
              disabled={savingMeta}
            >
              {savingMeta ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save metadata"
              )}
            </button>
          </div>
        </Section>

        {/* AI regeneration panels */}
        {current ? (
          <>
            <RegenSection
              title="Outline"
              sectionKey="outline"
              busy={regenBusy}
              onRegen={regenerate}
            >
              <ul className="space-y-2">
                {current.outline.map((o, i) => (
                  <li key={i}>
                    <div className="font-medium">{o.heading}</div>
                    <div className="muted text-sm">{o.summary}</div>
                  </li>
                ))}
              </ul>
            </RegenSection>

            <RegenSection
              title="Full content preview"
              sectionKey="content"
              busy={regenBusy}
              onRegen={regenerate}
            >
              <ContentPreview content={current.content} />
            </RegenSection>

            <RegenSection
              title="FAQ"
              sectionKey="faq"
              busy={regenBusy}
              onRegen={regenerate}
            >
              <ul className="space-y-3">
                {current.faq.map((f, i) => (
                  <li key={i}>
                    <div className="font-medium">{f.q}</div>
                    <div className="muted text-sm">{f.a}</div>
                  </li>
                ))}
              </ul>
            </RegenSection>

            <RegenSection
              title="Tags"
              sectionKey="tags"
              busy={regenBusy}
              onRegen={regenerate}
            >
              <div className="flex flex-wrap gap-2">
                {current.tags.map((t, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      background: "rgb(124 58 237 / 0.1)",
                      color: "rgb(124 58 237)",
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </RegenSection>
          </>
        ) : (
          <div className="card p-5 muted text-sm">
            No AI version on record for this product.
          </div>
        )}
      </div>

      {/* RIGHT: publish + versions */}
      <aside className="space-y-4 lg:sticky lg:top-20 h-fit">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Publish</h3>
          <p className="muted text-sm">
            Builds a fresh PDF from the current version, uploads it to private
            storage, and lists the product in the storefront.
          </p>
          {product.is_published ? (
            <>
              <button
                onClick={publish}
                disabled={publishBusy}
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
              >
                {publishBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Rebuild PDF
              </button>
              <button
                onClick={unpublish}
                disabled={publishBusy}
                className="w-full text-sm muted inline-flex items-center justify-center gap-2 py-2"
              >
                <EyeOff className="h-4 w-4" />
                Unpublish
              </button>
              <Link
                href={`/products/${product.slug}`}
                target="_blank"
                className="w-full text-sm inline-flex items-center justify-center gap-2 py-2 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View public page
              </Link>
            </>
          ) : (
            <button
              onClick={publish}
              disabled={publishBusy}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              {publishBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building PDF…
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" /> Publish product
                </>
              )}
            </button>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-2">Versions</h3>
          {versions.length === 0 ? (
            <p className="muted text-sm">No versions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">v{v.version_no}</div>
                    <div className="muted text-xs">
                      {v.notes ?? "—"}
                    </div>
                  </div>
                  <div className="muted text-xs shrink-0">
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------
 * Subcomponents
 * ------------------------------------------------------------- */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description ? (
          <p className="muted text-sm mt-1">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function RegenSection({
  title,
  sectionKey,
  busy,
  onRegen,
  children,
}: {
  title: string;
  sectionKey: SectionKey;
  busy: SectionKey | null;
  onRegen: (s: SectionKey) => void;
  children: React.ReactNode;
}) {
  const isBusy = busy === sectionKey;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        <button
          onClick={() => onRegen(sectionKey)}
          disabled={busy !== null}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors hover:bg-black/5 disabled:opacity-50"
          style={{ borderColor: "rgb(var(--border))" }}
        >
          {isBusy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCcw className="h-3 w-3" />
          )}
          Regenerate
        </button>
      </div>
      <div className={isBusy ? "opacity-60" : ""}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/**
 * Small-but-useful content previews per product type.
 * Everything is read-only; regenerate to change it.
 */
function ContentPreview({
  content,
}: {
  content: AiGeneratedProduct["content"];
}) {
  if (content.type === "ebook") {
    return (
      <ol className="space-y-3 list-decimal pl-5">
        {content.chapters.map((c, i) => (
          <li key={i}>
            <div className="font-medium">{c.title}</div>
            <div className="muted text-xs line-clamp-3 whitespace-pre-wrap">
              {c.body_markdown.slice(0, 240)}
              {c.body_markdown.length > 240 ? "…" : ""}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (content.type === "checklist") {
    return (
      <div className="space-y-4">
        {content.sections.map((s, i) => (
          <div key={i}>
            <div className="font-medium">{s.title}</div>
            <ul className="muted text-sm list-disc pl-5">
              {s.items.slice(0, 5).map((it, j) => (
                <li key={j}>{it}</li>
              ))}
              {s.items.length > 5 ? (
                <li className="muted">…+{s.items.length - 5} more</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (content.type === "prompt_pack") {
    return (
      <div className="space-y-4">
        {content.groups.map((g, i) => (
          <div key={i}>
            <div className="font-medium">{g.title}</div>
            <ul className="muted text-sm list-disc pl-5">
              {g.prompts.slice(0, 4).map((p, j) => (
                <li key={j}>{p.title}</li>
              ))}
              {g.prompts.length > 4 ? (
                <li className="muted">…+{g.prompts.length - 4} more</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (content.type === "template_bundle") {
    return (
      <ul className="space-y-2 list-disc pl-5">
        {content.templates.map((t, i) => (
          <li key={i}>
            <div className="font-medium">{t.title}</div>
            <div className="muted text-xs">{t.description}</div>
          </li>
        ))}
      </ul>
    );
  }
  // mini_course
  return (
    <ol className="space-y-3 list-decimal pl-5">
      {content.modules.map((m, i) => (
        <li key={i}>
          <div className="font-medium">{m.title}</div>
          <div className="muted text-xs">{m.summary}</div>
          <ul className="muted text-xs list-disc pl-5">
            {m.lessons.slice(0, 3).map((l, j) => (
              <li key={j}>{l.title}</li>
            ))}
            {m.lessons.length > 3 ? (
              <li>…+{m.lessons.length - 3} more lessons</li>
            ) : null}
          </ul>
        </li>
      ))}
    </ol>
  );
}
