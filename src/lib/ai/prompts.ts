import type { GenerationInput, ProductType, Tone } from "@/types/db";

const TONE_HINTS: Record<Tone, string> = {
  expert: "authoritative, precise, domain-savvy, zero fluff",
  friendly: "warm, approachable, conversational, second-person",
  concise: "brutally short, high signal-to-noise, scannable",
  playful: "witty, light humor, energetic, still useful",
  motivational: "inspiring, action-oriented, momentum-driving",
  neutral: "balanced, clear, professional",
};

const TYPE_INSTRUCTIONS: Record<ProductType, string> = {
  ebook: `
Generate an **eBook** with:
- 6-10 chapters.
- Each chapter: title + body_markdown (400-700 words). Use headings, short paragraphs, bullet lists, and one practical example where relevant.
- The full body MUST be real, complete prose — never "TBD" or "[insert example]".
- content.type MUST be "ebook".`,
  checklist: `
Generate a **Checklist Pack** with:
- 5-8 sections (each a sub-topic of the overall checklist).
- Each section: title + an array of 8-15 concrete, actionable checklist items (imperative voice).
- Items should be inspectable ("Verify X", "Configure Y"), not vague ("think about it").
- content.type MUST be "checklist".`,
  prompt_pack: `
Generate a **Prompt Pack** with:
- 4-6 groups organized by use case.
- Each group: title + 6-12 prompts.
- Each prompt: title (3-6 words), prompt (the full working prompt, 60-250 words, with placeholders in {curly_braces}), optional tip.
- Prompts must be complete, tested-feel prompts — not "write a prompt that does X".
- content.type MUST be "prompt_pack".`,
  template_bundle: `
Generate a **Template Bundle** with:
- 6-10 templates (each a ready-to-use document, email, framework, plan, or form).
- Each template: title + description (1-2 sentences) + body (the actual template in markdown, with {placeholders}).
- content.type MUST be "template_bundle".`,
  mini_course: `
Generate a **Mini-Course** with workbook with:
- 4-6 modules.
- Each module: title + 1-sentence summary + 3-5 lessons.
- Each lesson: title + content_markdown (250-500 words) + 2-4 exercises (short prompts for the learner).
- content.type MUST be "mini_course".`,
};

/**
 * Builds the system + user messages for a full generation run.
 * The model is expected to return a JSON object matching AiGeneratedProduct.
 */
export function buildGenerationMessages(input: GenerationInput): {
  system: string;
  user: string;
} {
  const [minCents, maxCents] = input.price_range_cents;
  const minUsd = (minCents / 100).toFixed(0);
  const maxUsd = (maxCents / 100).toFixed(0);

  const system = [
    "You are a senior product designer and copywriter who ships high-converting digital products.",
    "You produce COMPLETE, ready-to-sell content — never placeholders.",
    "You must reply with a single JSON object that strictly matches the provided schema.",
    "No prose outside the JSON. No markdown fences. No comments.",
    `Preferred tone: ${TONE_HINTS[input.tone]}.`,
  ].join(" ");

  const user = `
Create one complete digital product from the brief below.

### Brief
- Topic:              ${input.topic}
- Niche:              ${input.niche}
- Target audience:    ${input.audience}
- Product type:       ${input.product_type}
- Price range:        $${minUsd} - $${maxUsd}
- Extra instructions: ${input.extra_instructions?.trim() || "(none)"}

### Product-type instructions
${TYPE_INSTRUCTIONS[input.product_type]}

### Output JSON schema

{
  "product_type":   "${input.product_type}",
  "title":          string (6-12 words, specific, benefit-led, no clickbait),
  "subtitle":       string (12-22 words, specific promise),
  "description":    string (120-200 words — the sales-page body — with a hook, 3-5 bullet benefits, and a soft close),
  "outline":        [{"heading": string, "summary": string}, ... 5-8 items],
  "content":        object matching the product-type instructions above,
  "faq":            [{"q": string, "a": string}, ... 5-8 items],
  "call_to_action": string (6-12 words, imperative),
  "tags":           string[]  (5-10 lowercase single-word or short tags),
  "suggested_price_cents": integer in [${minCents}, ${maxCents}],
  "category_slug":  one of "marketing" | "productivity" | "business" | "design" | "ai" | "education"
}

Return the JSON now. Do not wrap it in code fences.
`.trim();

  return { system, user };
}

/**
 * Build prompt messages for regenerating ONE section of an existing product.
 * We include the current product as context and ask for a replacement of the
 * requested section only.
 */
export function buildRegenerationMessages(args: {
  section: "title" | "subtitle" | "description" | "outline" | "content" | "faq" | "call_to_action" | "tags";
  current: unknown;
  input: GenerationInput;
  notes?: string;
}): { system: string; user: string } {
  const { section, current, input, notes } = args;
  const system =
    "You are a senior copywriter. Rewrite ONLY the requested JSON section. Return a single JSON object with that section as the sole top-level key. No prose, no code fences.";
  const user = `
Brief: topic="${input.topic}", niche="${input.niche}", audience="${input.audience}", tone="${input.tone}", type="${input.product_type}".
Notes: ${notes?.trim() || "(none)"}

Current value for the "${section}" section:
${JSON.stringify(current, null, 2)}

Rewrite it, keeping the same JSON shape as the current value. Return:
{ "${section}": <new value> }
`.trim();
  return { system, user };
}
