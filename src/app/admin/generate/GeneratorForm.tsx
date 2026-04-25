"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "@/components/Toaster";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  type ProductType,
  type Tone,
} from "@/types/db";

const TONES: { value: Tone; label: string }[] = [
  { value: "expert", label: "Expert — authoritative" },
  { value: "friendly", label: "Friendly — warm" },
  { value: "concise", label: "Concise — no fluff" },
  { value: "playful", label: "Playful — witty" },
  { value: "motivational", label: "Motivational — action-driven" },
  { value: "neutral", label: "Neutral — balanced" },
];

type Preset = {
  type: ProductType;
  title: string;
  hint: string;
  min: number;
  max: number;
};

const PRESETS: Preset[] = [
  {
    type: "ebook",
    title: "eBook",
    hint: "Deep-dive guide, 6-10 chapters",
    min: 900,
    max: 2900,
  },
  {
    type: "checklist",
    title: "Checklist pack",
    hint: "Actionable step-by-step lists",
    min: 500,
    max: 1900,
  },
  {
    type: "prompt_pack",
    title: "Prompt pack",
    hint: "Ready-to-use AI prompts",
    min: 900,
    max: 2900,
  },
  {
    type: "template_bundle",
    title: "Template bundle",
    hint: "Fill-in templates & frameworks",
    min: 1200,
    max: 3900,
  },
  {
    type: "mini_course",
    title: "Mini-course",
    hint: "Modules + workbook exercises",
    min: 1900,
    max: 7900,
  },
];

export default function GeneratorForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [productType, setProductType] = useState<ProductType>("ebook");
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<Tone>("expert");
  const [minPrice, setMinPrice] = useState(9);
  const [maxPrice, setMaxPrice] = useState(29);
  const [extra, setExtra] = useState("");

  function selectPreset(p: Preset) {
    setProductType(p.type);
    setMinPrice(Math.round(p.min / 100));
    setMaxPrice(Math.round(p.max / 100));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!topic.trim() || !niche.trim() || !audience.trim()) {
      toast("Fill topic, niche and audience", "error");
      return;
    }
    if (minPrice > maxPrice) {
      toast("Min price must be ≤ max price", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          niche: niche.trim(),
          audience: audience.trim(),
          tone,
          product_type: productType,
          price_range_cents: [
            Math.round(minPrice * 100),
            Math.round(maxPrice * 100),
          ],
          extra_instructions: extra.trim() || undefined,
        }),
      });
      const json = (await res.json()) as
        | { product_id: string }
        | { error: string };

      if (!res.ok || !("product_id" in json)) {
        const message = "error" in json ? json.error : "Generation failed";
        toast(message, "error");
        setSubmitting(false);
        return;
      }

      toast("Draft generated — redirecting to editor…", "success");
      router.push(`/admin/products/${json.product_id}/edit`);
    } catch (err) {
      console.error(err);
      toast(
        err instanceof Error ? err.message : "Network error",
        "error",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* 1. Product type presets */}
      <section>
        <Label step={1}>Pick a product type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {PRESETS.map((p) => {
            const selected = productType === p.type;
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => selectPreset(p)}
                className="card text-left p-4 transition-all"
                style={{
                  borderColor: selected
                    ? "rgb(124 58 237)"
                    : undefined,
                  boxShadow: selected
                    ? "0 0 0 2px rgb(124 58 237 / 0.4)"
                    : undefined,
                }}
              >
                <div className="font-semibold">{p.title}</div>
                <div className="muted text-xs mt-1">{p.hint}</div>
                <div className="muted text-xs mt-2">
                  Suggested: ${p.min / 100}-${p.max / 100}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. The brief */}
      <section className="card p-5 space-y-4">
        <Label step={2}>Write the brief</Label>
        <Field label="Topic" help="The product's core subject.">
          <input
            className="input w-full"
            placeholder="e.g. Landing-page copywriting for SaaS founders"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </Field>
        <Field label="Niche" help="Industry or vertical.">
          <input
            className="input w-full"
            placeholder="e.g. B2B SaaS"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Target audience"
          help="Who will buy this? Be specific about their role and pain."
        >
          <input
            className="input w-full"
            placeholder="e.g. Solo SaaS founders doing their own marketing"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tone">
            <select
              className="input w-full"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product type">
            <select
              className="input w-full"
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
            >
              {PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {PRODUCT_TYPE_LABELS[pt]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* 3. Pricing */}
      <section className="card p-5 space-y-4">
        <Label step={3}>Pricing range</Label>
        <p className="muted text-sm">
          The assistant will suggest a price inside this range (USD). You can
          override it later.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min price ($)">
            <input
              type="number"
              min={0}
              step={1}
              className="input w-full"
              value={minPrice}
              onChange={(e) => setMinPrice(Math.max(0, Number(e.target.value)))}
            />
          </Field>
          <Field label="Max price ($)">
            <input
              type="number"
              min={0}
              step={1}
              className="input w-full"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Math.max(0, Number(e.target.value)))}
            />
          </Field>
        </div>
      </section>

      {/* 4. Extras */}
      <section className="card p-5">
        <Label step={4}>Extra instructions (optional)</Label>
        <p className="muted text-sm mt-1">
          Anything the assistant should emphasize, avoid, or include.
        </p>
        <textarea
          rows={4}
          className="input w-full mt-3"
          placeholder="e.g. Mention case studies from YC companies. Avoid jargon. Include a 7-day action plan."
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        {submitting ? (
          <p className="muted text-sm">
            Generating can take 20-60 seconds…
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate product
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Label({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
        style={{ background: "rgb(124 58 237)" }}
      >
        {step}
      </span>
      <h2 className="font-semibold">{children}</h2>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {help ? <span className="muted text-xs block mt-0.5">{help}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
