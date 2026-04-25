export type OrderStatus = "pending" | "paid" | "failed" | "refunded";

export type ProductType =
  | "ebook"
  | "checklist"
  | "prompt_pack"
  | "template_bundle"
  | "mini_course";

export const PRODUCT_TYPES: readonly ProductType[] = [
  "ebook",
  "checklist",
  "prompt_pack",
  "template_bundle",
  "mini_course",
] as const;

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  ebook: "eBook (PDF)",
  checklist: "Checklist pack",
  prompt_pack: "Prompt pack",
  template_bundle: "Template bundle",
  mini_course: "Mini-course + workbook",
};

export type AssetKind = "pdf" | "cover" | "preview";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type OutlineItem = { heading: string; summary: string };
export type FaqItem = { q: string; a: string };

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  category: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;

  // AI generator additions
  product_type: ProductType | null;
  subtitle: string | null;
  outline: OutlineItem[];
  faq: FaqItem[];
  tags: string[];
  call_to_action: string | null;
  generation_prompt: GenerationInput | null;
  category_id: string | null;
  current_version_id: string | null;
};

export type ProductVersion = {
  id: string;
  product_id: string;
  version_no: number;
  generated_json: AiGeneratedProduct;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type GeneratedAsset = {
  id: string;
  product_id: string;
  version_id: string | null;
  kind: AssetKind;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string | null;
  email: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  title: string;
  unit_price_cents: number;
  quantity: number;
  created_at: string;
};

export type Purchase = {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string | null;
  download_count: number;
  last_downloaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DownloadAuditEntry = {
  id: string;
  user_id: string | null;
  product_id: string;
  purchase_id: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type CartItem = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  quantity: number;
};

/* =============================================================
 * AI generation types
 * ============================================================= */

export type Tone =
  | "expert"
  | "friendly"
  | "concise"
  | "playful"
  | "motivational"
  | "neutral";

export type GenerationInput = {
  topic: string;
  niche: string;
  tone: Tone;
  audience: string;
  product_type: ProductType;
  /** Range in cents, e.g. [900, 2900] means $9-$29. */
  price_range_cents: [number, number];
  extra_instructions?: string;
};

export type EbookContent = {
  type: "ebook";
  chapters: { title: string; body_markdown: string }[];
};

export type ChecklistContent = {
  type: "checklist";
  sections: { title: string; items: string[] }[];
};

export type PromptPackContent = {
  type: "prompt_pack";
  groups: {
    title: string;
    prompts: { title: string; prompt: string; tip?: string }[];
  }[];
};

export type TemplateBundleContent = {
  type: "template_bundle";
  templates: {
    title: string;
    description: string;
    body: string; // markdown / fill-in-the-blanks
  }[];
};

export type MiniCourseContent = {
  type: "mini_course";
  modules: {
    title: string;
    summary: string;
    lessons: {
      title: string;
      content_markdown: string;
      exercises?: string[];
    }[];
  }[];
};

export type ProductContent =
  | EbookContent
  | ChecklistContent
  | PromptPackContent
  | TemplateBundleContent
  | MiniCourseContent;

/* =============================================================
 * Marketing + Sales Agent
 * ============================================================= */

export type PostChannel =
  | "telegram"
  | "email"
  | "twitter"
  | "linkedin"
  | "reddit";

export const POST_CHANNELS: readonly PostChannel[] = [
  "telegram",
  "email",
  "twitter",
  "linkedin",
  "reddit",
] as const;

export const POST_CHANNEL_LABELS: Record<PostChannel, string> = {
  telegram: "Telegram channel",
  email: "Email newsletter",
  twitter: "Twitter / X thread",
  linkedin: "LinkedIn post",
  reddit: "Reddit post",
};

/** Which channels the cron can actually post to (vs. draft-only). */
export const AUTO_POST_CHANNELS: readonly PostChannel[] = [
  "telegram",
  "email",
] as const;

export type PostStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "posted"
  | "failed"
  | "archived";

export type AgentPost = {
  id: string;
  product_id: string | null;
  channel: PostChannel;
  status: PostStatus;
  subject: string | null;
  body: string;
  media_url: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  external_id: string | null;
  error: string | null;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterSubscriber = {
  id: string;
  email: string;
  user_id: string | null;
  source: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type CheckoutStatus = "pending" | "completed" | "expired";

export type AbandonedCheckout = {
  id: string;
  stripe_session_id: string;
  user_id: string | null;
  email: string | null;
  total_cents: number;
  currency: string;
  product_ids: string[];
  status: CheckoutStatus;
  recovery_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SuggestionKind =
  | "regenerate_description"
  | "regenerate_title"
  | "low_sales"
  | "price_review"
  | "other";

export type SuggestionStatus = "open" | "dismissed" | "applied";

export type AgentSuggestion = {
  id: string;
  product_id: string | null;
  kind: SuggestionKind;
  status: SuggestionStatus;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AiGeneratedProduct = {
  product_type: ProductType;
  title: string;
  subtitle: string;
  description: string;
  outline: OutlineItem[];
  content: ProductContent;
  faq: FaqItem[];
  call_to_action: string;
  tags: string[];
  suggested_price_cents: number;
  category_slug: string;
};
