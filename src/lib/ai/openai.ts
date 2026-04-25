import OpenAI from "openai";
import { env } from "@/lib/env";
import type { AiGeneratedProduct, GenerationInput, ProductType } from "@/types/db";
import {
  buildGenerationMessages,
  buildRegenerationMessages,
} from "./prompts";

/* -------------------------------------------------------------
 * Singleton client
 * ------------------------------------------------------------- */
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to .env.local and restart the server.",
    );
  }
  if (!_client) _client = new OpenAI({ apiKey: env.openaiApiKey });
  return _client;
}

/* -------------------------------------------------------------
 * Public generator
 * ------------------------------------------------------------- */
export async function generateProduct(
  input: GenerationInput,
): Promise<AiGeneratedProduct> {
  const client = getClient();
  const { system, user } = buildGenerationMessages(input);

  const response = await client.chat.completions.create({
    model: env.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");

  const parsed = safeParseJson(text);
  validateGeneratedProduct(parsed, input.product_type);
  return parsed as AiGeneratedProduct;
}

/* -------------------------------------------------------------
 * Regenerate a single section
 * ------------------------------------------------------------- */
export async function regenerateSection<
  S extends keyof AiGeneratedProduct,
>(args: {
  section: S;
  current: AiGeneratedProduct[S];
  input: GenerationInput;
  notes?: string;
}): Promise<AiGeneratedProduct[S]> {
  const client = getClient();
  const { system, user } = buildRegenerationMessages({
    section: args.section as Exclude<
      keyof AiGeneratedProduct,
      "product_type" | "suggested_price_cents" | "category_slug"
    >,
    current: args.current,
    input: args.input,
    notes: args.notes,
  });

  const response = await client.chat.completions.create({
    model: env.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");

  const parsed = safeParseJson(text) as Record<string, unknown>;
  if (!(args.section in parsed)) {
    throw new Error(
      `OpenAI response missing field "${String(args.section)}"`,
    );
  }
  return parsed[args.section as string] as AiGeneratedProduct[S];
}

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Model occasionally wraps JSON in fences despite instructions.
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(stripped);
  }
}

function validateGeneratedProduct(
  raw: unknown,
  expectedType: ProductType,
): asserts raw is AiGeneratedProduct {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response is not a JSON object");
  }
  const r = raw as Record<string, unknown>;
  const required = [
    "product_type",
    "title",
    "subtitle",
    "description",
    "outline",
    "content",
    "faq",
    "call_to_action",
    "tags",
    "suggested_price_cents",
    "category_slug",
  ];
  for (const k of required) {
    if (!(k in r)) throw new Error(`AI response missing field "${k}"`);
  }
  if (r.product_type !== expectedType) {
    // Not fatal — some models normalize. Coerce.
    r.product_type = expectedType;
  }
  const content = r.content as Record<string, unknown> | null;
  if (!content || typeof content !== "object") {
    throw new Error("AI response.content must be an object");
  }
  if (content.type !== expectedType) content.type = expectedType;

  if (!Array.isArray(r.outline)) throw new Error("outline must be an array");
  if (!Array.isArray(r.faq)) throw new Error("faq must be an array");
  if (!Array.isArray(r.tags)) throw new Error("tags must be an array");
  if (typeof r.suggested_price_cents !== "number") {
    throw new Error("suggested_price_cents must be a number");
  }
}
