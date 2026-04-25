-- =============================================================
-- 0003_agent.sql
-- Marketing + Sales Agent:
--   - agent_posts           (generated drafts per channel)
--   - newsletter_subscribers
--   - abandoned_checkouts   (for cart-recovery emails)
--   - agent_suggestions     (low-performer products, etc.)
-- Idempotent — safe to re-run.
-- =============================================================

-- Channels the agent can target. `reddit/twitter/linkedin` are draft-only
-- (copy-paste), `telegram/email` are fully automated.
do $$ begin
  create type public.post_channel as enum (
    'telegram', 'email', 'twitter', 'linkedin', 'reddit'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_status as enum (
    'draft', 'approved', 'scheduled', 'posted', 'failed', 'archived'
  );
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- agent_posts
-- One row per (product, channel) draft. Body can be rewritten by
-- the admin before approval.
-- -------------------------------------------------------------
create table if not exists public.agent_posts (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid references public.products(id) on delete cascade,
  channel        public.post_channel not null,
  status         public.post_status not null default 'draft',
  subject        text,                 -- used as email subject / telegram caption
  body           text not null,
  media_url      text,                 -- optional image URL for telegram/email
  scheduled_at   timestamptz,
  posted_at      timestamptz,
  external_id    text,                 -- e.g. Telegram message_id
  error          text,
  meta           jsonb not null default '{}'::jsonb,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists agent_posts_product_idx  on public.agent_posts (product_id);
create index if not exists agent_posts_status_idx   on public.agent_posts (status);
create index if not exists agent_posts_schedule_idx on public.agent_posts (scheduled_at)
  where status in ('approved', 'scheduled');

-- -------------------------------------------------------------
-- newsletter_subscribers
-- -------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  user_id             uuid references public.profiles(id) on delete set null,
  source              text,                              -- home-hero, product-page, checkout, etc.
  confirmed_at        timestamptz,                       -- reserved for double opt-in
  unsubscribed_at     timestamptz,
  unsubscribe_token   text unique not null default encode(gen_random_bytes(24), 'hex'),
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists newsletter_active_idx
  on public.newsletter_subscribers (created_at desc)
  where unsubscribed_at is null;

-- -------------------------------------------------------------
-- abandoned_checkouts
-- Populated by /api/checkout and marked completed by the Stripe webhook.
-- The agent's cron looks for rows where status='pending' and created_at
-- is older than 24h, then sends a recovery email.
-- -------------------------------------------------------------
do $$ begin
  create type public.checkout_status as enum ('pending', 'completed', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.abandoned_checkouts (
  id                       uuid primary key default gen_random_uuid(),
  stripe_session_id        text unique not null,
  user_id                  uuid references public.profiles(id) on delete set null,
  email                    text,
  total_cents              integer not null default 0,
  currency                 text not null default 'usd',
  product_ids              uuid[] not null default '{}',
  status                   public.checkout_status not null default 'pending',
  recovery_email_sent_at   timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists abandoned_checkouts_status_idx
  on public.abandoned_checkouts (status, created_at);

-- -------------------------------------------------------------
-- agent_suggestions
-- The cron fills this with actionable insights: "regenerate this
-- product's copy", "price looks too high", etc.
-- -------------------------------------------------------------
do $$ begin
  create type public.suggestion_kind as enum (
    'regenerate_description', 'regenerate_title', 'low_sales', 'price_review', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.suggestion_status as enum ('open', 'dismissed', 'applied');
exception when duplicate_object then null; end $$;

create table if not exists public.agent_suggestions (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.products(id) on delete cascade,
  kind        public.suggestion_kind not null,
  status      public.suggestion_status not null default 'open',
  message     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists agent_suggestions_status_idx
  on public.agent_suggestions (status, created_at desc);

-- -------------------------------------------------------------
-- updated_at triggers (reuses the helper defined in schema.sql)
-- -------------------------------------------------------------
do $$ begin
  create trigger agent_posts_updated_at
    before update on public.agent_posts
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger abandoned_checkouts_updated_at
    before update on public.abandoned_checkouts
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger agent_suggestions_updated_at
    before update on public.agent_suggestions
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.agent_posts             enable row level security;
alter table public.newsletter_subscribers  enable row level security;
alter table public.abandoned_checkouts     enable row level security;
alter table public.agent_suggestions       enable row level security;

-- agent_posts: admin-only
drop policy if exists "agent_posts: admin all" on public.agent_posts;
create policy "agent_posts: admin all"
  on public.agent_posts for all
  using (public.is_admin())
  with check (public.is_admin());

-- newsletter_subscribers: public can INSERT (subscribe); admin can read.
-- Unsubscribe is done server-side via service role + token.
drop policy if exists "newsletter: public insert" on public.newsletter_subscribers;
create policy "newsletter: public insert"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "newsletter: admin read" on public.newsletter_subscribers;
create policy "newsletter: admin read"
  on public.newsletter_subscribers for select
  using (public.is_admin());

-- abandoned_checkouts + suggestions: admin-only surface (webhook uses
-- service-role which bypasses RLS).
drop policy if exists "abandoned: admin all" on public.abandoned_checkouts;
create policy "abandoned: admin all"
  on public.abandoned_checkouts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "suggestions: admin all" on public.agent_suggestions;
create policy "suggestions: admin all"
  on public.agent_suggestions for all
  using (public.is_admin())
  with check (public.is_admin());
