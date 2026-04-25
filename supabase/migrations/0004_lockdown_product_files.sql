-- =============================================================
-- 0004_lockdown_product_files.sql
--
-- SECURITY HARDENING — hide internal storage paths from clients.
--
-- Background
-- ----------
-- The original schema (0001) put `file_path` directly on
-- `public.products`. Combined with the row-level policy
--     "products: read published or admin"  (USING is_published = true)
-- this meant ANY anonymous visitor could call:
--     GET /rest/v1/products?select=file_path&is_published=eq.true
-- and walk away with the full storage map of every published file.
--
-- That alone is not a download bypass — the `products` storage bucket
-- is private and direct object access is still RLS-denied — but it is
-- valuable reconnaissance and one accidental "make bucket public"
-- away from a full bypass.
--
-- Why a column-level REVOKE is not enough by itself
-- -------------------------------------------------
-- Supabase ships every public-schema table with a TABLE-level
--   GRANT SELECT ON public.<table> TO anon, authenticated;
-- In PostgreSQL, a column-level REVOKE has NO effect while the role
-- still holds table-level SELECT — it can only restrict columns when
-- the role does not already have whole-table SELECT.
--
-- So the correct lock-down is:
--   1. drop the wide table-level SELECT for the two PostgREST roles
--   2. re-grant SELECT on an explicit allowlist of columns (every
--      column EXCEPT `file_path`)
--   3. ask PostgREST to reload its schema cache so it picks up the
--      new column privileges immediately
--
-- The `service_role` Postgres role bypasses RLS and column grants,
-- so the server-side download / admin / Stripe-webhook flows that
-- use createSupabaseAdminClient keep full access to `file_path`.
--
-- This migration is idempotent: REVOKE on a privilege the role does
-- not have is a no-op, and GRANT on a privilege the role already has
-- is a no-op.
-- =============================================================

-- 1. Drop the wide table-level SELECT so column-level grants take effect.
revoke select on public.products from anon;
revoke select on public.products from authenticated;

-- 2. Grant SELECT on every column EXCEPT `file_path`.
--    Keep this list in sync with the live schema and with
--    src/lib/products/columns.ts (PUBLIC_PRODUCT_COLUMNS).
grant select (
  id,
  slug,
  title,
  description,
  price_cents,
  currency,
  image_url,
  file_name,
  file_size_bytes,
  category,
  is_published,
  created_at,
  updated_at
) on public.products to anon;

grant select (
  id,
  slug,
  title,
  description,
  price_cents,
  currency,
  image_url,
  file_name,
  file_size_bytes,
  category,
  is_published,
  created_at,
  updated_at
) on public.products to authenticated;

-- 3. Document the column so future contributors do not re-add a
--    table-level grant by accident.
comment on column public.products.file_path is
  'Path inside the PRIVATE storage bucket. Server-only — anon and '
  'authenticated have NO column grant for it (see migration 0004). '
  'Read it exclusively through the service-role client '
  '(createSupabaseAdminClient).';

-- 4. Force PostgREST to reload its in-memory schema cache so the new
--    column privileges take effect on the next request, not in a few
--    minutes when it normally polls.
notify pgrst, 'reload schema';
