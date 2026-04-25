-- =============================================================
-- Digital Store - Database schema
-- Tables:   profiles, products, orders, order_items, purchases
-- Security: Row Level Security with admin role support
-- Extras:   updated_at triggers, auto-profile on signup
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Generic updated_at trigger
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- profiles  (1-1 with auth.users)
-- =============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- products
-- =============================================================
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  description     text not null default '',
  price_cents     integer not null check (price_cents >= 0),
  currency        text not null default 'usd',
  image_url       text,
  -- Path INSIDE the private "products" storage bucket, e.g. "files/abc.zip"
  file_path       text not null,
  file_name       text not null,
  file_size_bytes bigint not null default 0,
  category        text,
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists products_published_idx on public.products (is_published, created_at desc);
create index if not exists products_category_idx  on public.products (category);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =============================================================
-- orders
-- =============================================================
do $$ begin
  create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete set null,
  email                 text not null,
  status                public.order_status not null default 'pending',
  total_cents           integer not null default 0,
  currency              text not null default 'usd',
  stripe_session_id     text unique,
  stripe_payment_intent text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- =============================================================
-- order_items
-- =============================================================
create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  title            text not null,
  unit_price_cents integer not null,
  quantity         integer not null default 1,
  created_at       timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- =============================================================
-- purchases  (access grants - "the user owns this product")
-- =============================================================
create table if not exists public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  product_id          uuid not null references public.products(id) on delete cascade,
  order_id            uuid references public.orders(id) on delete set null,
  download_count      integer not null default 0,
  last_downloaded_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists purchases_user_idx on public.purchases (user_id);

drop trigger if exists trg_purchases_updated_at on public.purchases;
create trigger trg_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.purchases   enable row level security;

-- Helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- profiles ------------------------------------------------
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- products ------------------------------------------------
drop policy if exists "products: read published or admin" on public.products;
create policy "products: read published or admin"
  on public.products for select
  using (is_published = true or public.is_admin());

drop policy if exists "products: admin write" on public.products;
create policy "products: admin write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- orders --------------------------------------------------
drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

-- order_items follow the parent order
drop policy if exists "order_items: read via order" on public.order_items;
create policy "order_items: read via order"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ));

-- purchases -----------------------------------------------
drop policy if exists "purchases: read own or admin" on public.purchases;
create policy "purchases: read own or admin"
  on public.purchases for select
  using (user_id = auth.uid() or public.is_admin());

-- NOTE: Inserts into orders / order_items / purchases happen via the
-- service-role key in the Stripe webhook (bypasses RLS intentionally).

-- =============================================================
-- Storage
-- =============================================================
-- After running this SQL, create a PRIVATE bucket named `products`:
--   Supabase Dashboard -> Storage -> New bucket -> "products" -> Public = OFF
-- No public policies are added: files are only served through signed URLs
-- from the authenticated /api/download/[productId] server route.
