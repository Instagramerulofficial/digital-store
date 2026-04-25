-- =============================================================
-- 0002_ai_generator.sql
-- Adds AI product-generator tables and columns on top of the
-- initial schema (profiles/products/orders/order_items/purchases).
-- Safe to run multiple times (idempotent).
-- =============================================================

-- -------------------------------------------------------------
-- enum: product_type
-- -------------------------------------------------------------
do $$ begin
  create type public.product_type as enum (
    'ebook', 'checklist', 'prompt_pack', 'template_bundle', 'mini_course'
  );
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- categories
-- -------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Seed a few sensible defaults (no-op if they already exist).
insert into public.categories (slug, name, description) values
  ('marketing',     'Marketing',     'Guides, playbooks and copy for growth teams.'),
  ('productivity',  'Productivity',  'Systems, templates and checklists to ship faster.'),
  ('business',      'Business',      'Starter kits and playbooks for founders.'),
  ('design',        'Design',        'UI/UX systems, asset packs, templates.'),
  ('ai',            'AI',            'Prompt packs, workflows, tool guides.'),
  ('education',     'Education',     'Mini-courses, workbooks, study guides.')
on conflict (slug) do nothing;

-- -------------------------------------------------------------
-- products: extend with AI + type metadata
-- -------------------------------------------------------------
alter table public.products
  add column if not exists product_type        public.product_type,
  add column if not exists subtitle            text,
  add column if not exists outline             jsonb not null default '[]'::jsonb,
  add column if not exists faq                 jsonb not null default '[]'::jsonb,
  add column if not exists tags                text[] not null default '{}',
  add column if not exists call_to_action      text,
  add column if not exists generation_prompt   jsonb,
  add column if not exists category_id         uuid references public.categories(id) on delete set null,
  add column if not exists current_version_id  uuid;

create index if not exists products_type_idx       on public.products (product_type);
create index if not exists products_tags_gin_idx   on public.products using gin (tags);
create index if not exists products_category_id_idx on public.products (category_id);

-- -------------------------------------------------------------
-- product_versions: every AI generation is stored as a version
-- -------------------------------------------------------------
create table if not exists public.product_versions (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  version_no     integer not null,
  generated_json jsonb not null,     -- the raw AiGeneratedProduct payload
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (product_id, version_no)
);

create index if not exists product_versions_product_idx
  on public.product_versions (product_id, version_no desc);

-- Add the FK from products.current_version_id now that the table exists.
do $$ begin
  alter table public.products
    add constraint products_current_version_fk
    foreign key (current_version_id)
    references public.product_versions(id)
    on delete set null;
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- generated_assets: files produced during publishing (PDF, cover, ...)
-- -------------------------------------------------------------
do $$ begin
  create type public.asset_kind as enum ('pdf', 'cover', 'preview');
exception when duplicate_object then null; end $$;

create table if not exists public.generated_assets (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  version_id      uuid references public.product_versions(id) on delete set null,
  kind            public.asset_kind not null,
  file_path       text not null,          -- path inside storage bucket
  file_name       text not null,
  file_size_bytes bigint not null default 0,
  mime_type       text not null default 'application/octet-stream',
  created_at      timestamptz not null default now()
);

create index if not exists generated_assets_product_idx
  on public.generated_assets (product_id, kind);

-- -------------------------------------------------------------
-- downloads: per-download audit log (one row per click)
-- -------------------------------------------------------------
create table if not exists public.downloads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  product_id  uuid not null references public.products(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists downloads_user_idx    on public.downloads (user_id, created_at desc);
create index if not exists downloads_product_idx on public.downloads (product_id, created_at desc);

-- =============================================================
-- Row Level Security for new tables
-- =============================================================

alter table public.categories        enable row level security;
alter table public.product_versions  enable row level security;
alter table public.generated_assets  enable row level security;
alter table public.downloads         enable row level security;

-- Categories are public (anyone can read)
drop policy if exists "categories: read all" on public.categories;
create policy "categories: read all"
  on public.categories for select
  using (true);

drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- Versions & assets are admin-only via the dashboard / API. The webhook and
-- public download routes use the service-role key, which bypasses RLS.
drop policy if exists "product_versions: admin read" on public.product_versions;
create policy "product_versions: admin read"
  on public.product_versions for select
  using (public.is_admin());

drop policy if exists "product_versions: admin write" on public.product_versions;
create policy "product_versions: admin write"
  on public.product_versions for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "generated_assets: admin read" on public.generated_assets;
create policy "generated_assets: admin read"
  on public.generated_assets for select
  using (public.is_admin());

drop policy if exists "generated_assets: admin write" on public.generated_assets;
create policy "generated_assets: admin write"
  on public.generated_assets for all
  using (public.is_admin())
  with check (public.is_admin());

-- Downloads: users see their own, admins see everything.
drop policy if exists "downloads: read own or admin" on public.downloads;
create policy "downloads: read own or admin"
  on public.downloads for select
  using (user_id = auth.uid() or public.is_admin());

-- Inserts happen from the /api/download route via service-role.
