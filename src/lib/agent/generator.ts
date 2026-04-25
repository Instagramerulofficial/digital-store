import OpenAI from "openai";
import { env } from "@/lib/env";
import type { PostChannel, Product } from "@/types/db";

/**
 * Marketing copy generator — produces one post per channel.
 * Each channel has a dedicated system prompt tuned to its format/limits.
 */

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!env.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to .env.local to enable the agent.",
    );
  }
  if (!_client) _client = new OpenAI({ apiKey: env.openaiApiKey });
  return _client;
}

export type GeneratedPost = {
  channel: PostChannel;
  subject: string | null;
  body: string;
  media_url: string | null;
};

/* -------------------------------------------------------------
 * Channel-specific prompts
 * ------------------------------------------------------------- */

const CHANNEL_PROMPTS: Record<
  PostChannel,
  { system: string; jsonShape: string }
> = {
  telegram: {
    system: `You are a social-media copywriter writing a Telegram channel post announcing a new digital product.
Rules:
- 400-700 characters total, plain text, no markdown syntax (no **, no [], no _).
- Use emojis sparingly (2-4 max). A good pattern: hook line (with emoji), 3-4 short benefit bullets (•), closing CTA.
- End with a short call-to-action. Do NOT include the URL — the app adds an inline button separately.
- Output MUST be a single JSON object: { "body": string }. No prose outside the JSON.`,
    jsonShape: `{ "body": string }`,
  },
  email: {
    system: `You are an email copywriter writing a newsletter email announcing a new digital product to existing subscribers.
Rules:
- subject: 30-55 characters, specific benefit, no clickbait, no emojis.
- body: 120-220 words, HTML-safe plain text (no tags — the app wraps it in an HTML template). Use short paragraphs separated by blank lines. Do NOT include links or buttons — the app appends a CTA button.
- Friendly tone, second person, no "Dear subscriber".
- Output MUST be a single JSON object: { "subject": string, "body": string }. No prose outside the JSON.`,
    jsonShape: `{ "subject": string, "body": string }`,
  },
  twitter: {
    system: `You are a Twitter/X copywriter writing a thread announcing a new digital product.
Rules:
- 4-6 tweets, each <= 270 characters (leave room for URL & image).
- Tweet 1 = hook (strong, specific, no generic "Excited to announce").
- Middle tweets = 1 concrete benefit / insight each.
- Last tweet = soft CTA + placeholder {PRODUCT_URL}.
- No hashtag soup (max 2 tags in the whole thread).
- Output MUST be a single JSON object: { "body": string } where body is the thread with tweets separated by the literal string "\\n\\n---\\n\\n". No prose outside the JSON.`,
    jsonShape: `{ "body": string }`,
  },
  linkedin: {
    system: `You are a LinkedIn copywriter writing a product-launch post for professionals.
Rules:
- 600-900 characters.
- Start with a punchy first line that survives the "…see more" truncation (first 200 chars must tease the value).
- Use short paragraphs (1-2 lines each) separated by blank lines.
- Include 1-2 relevant hashtags at the end, not inline.
- Include the placeholder {PRODUCT_URL} where the link should go.
- Professional but human tone — no corporate fluff.
- Output MUST be a single JSON object: { "body": string }. No prose outside the JSON.`,
    jsonShape: `{ "body": string }`,
  },
  reddit: {
    system: `You are a Reddit copywriter. Reddit strongly penalises promotion, so this post is written as a genuinely useful share: a quick lessons-learned / framework / opinion piece that ends with a soft mention of the product.
Rules:
- subject = Reddit post title, 60-120 characters, NO "I made" / "I built", NO emojis.
- body = 180-400 words of actual useful content (a framework, 5 tips, a lesson learned), then ONE last paragraph mentioning the product with the placeholder {PRODUCT_URL}.
- Plain text, no markdown.
- Output MUST be a single JSON object: { "subject": string, "body": string }. No prose outside the JSON.`,
    jsonShape: `{ "subject": string, "body": string }`,
  },
};

/* -------------------------------------------------------------
 * User prompt = product context
 * ------------------------------------------------------------- */

function productBrief(product: Product): string {
  const tags = (product.tags ?? []).slice(0, 8).join(", ") || "(none)";
  return [
    `Product title: ${product.title}`,
    product.subtitle ? `Subtitle: ${product.subtitle}` : null,
    `Category: ${product.category ?? "(none)"}`,
    `Product type: ${product.product_type ?? "digital product"}`,
    `Tags: ${tags}`,
    `Price (USD): $${(product.price_cents / 100).toFixed(2)}`,
    "",
    "Sales description:",
    product.description,
    product.call_to_action
      ? `\nCall-to-action already used on sales page: "${product.call_to_action}"`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------- */

export async function generatePostForChannel(
  product: Product,
  channel: PostChannel,
): Promise<GeneratedPost> {
  const client = getClient();
  const prompt = CHANNEL_PROMPTS[channel];

  const response = await client.chat.completions.create({
    model: env.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.8,
    messages: [
      { role: "system", content: prompt.system },
      {
        role: "user",
        content: `Write the post for this product. Reply with ${prompt.jsonShape}.\n\n${productBrief(product)}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = safeParseJson(text);

  return {
    channel,
    subject:
      "subject" in parsed && typeof parsed.subject === "string"
        ? parsed.subject
        : null,
    body:
      "body" in parsed && typeof parsed.body === "string"
        ? parsed.body
        : "",
    media_url: product.image_url,
  };
}

/**
 * Generate drafts for multiple channels in parallel.
 * Failures for a single channel are caught so others still succeed.
 */
export async function generatePostsForProduct(
  product: Product,
  channels: PostChannel[],
): Promise<
  { channel: PostChannel; post?: GeneratedPost; error?: string }[]
> {
  const jobs = channels.map(async (channel) => {
    try {
      const post = await generatePostForChannel(product, channel);
      return { channel, post };
    } catch (err) {
      return {
        channel,
        error: err instanceof Error ? err.message : "Failed",
      };
    }
  });
  return await Promise.all(jobs);
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      return { body: text.trim() };
    }
  }
}
