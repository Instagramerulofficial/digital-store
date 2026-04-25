/**
 * Single source of truth for which columns of `public.products` may be
 * read by anonymous / authenticated users (i.e. by anything other than
 * the service-role admin client).
 *
 * `file_path` is intentionally NOT in this list and the matching
 * REVOKE in `supabase/migrations/0004_lockdown_product_files.sql`
 * makes the column unreadable via PostgREST for anon + authenticated
 * roles. Public pages MUST use this constant (or a subset of it)
 * instead of `select("*")`, otherwise PostgREST will reject the query
 * with "permission denied for column file_path".
 *
 * Internal storage paths must only be touched by the server-side
 * download / publish routes, which use the service-role admin client
 * and therefore bypass RLS + column grants.
 */
export const PUBLIC_PRODUCT_COLUMNS = [
  "id",
  "slug",
  "title",
  "subtitle",
  "description",
  "price_cents",
  "currency",
  "image_url",
  "file_name",
  "file_size_bytes",
  "category",
  "category_id",
  "tags",
  "product_type",
  "outline",
  "faq",
  "call_to_action",
  "current_version_id",
  "is_published",
  "created_at",
  "updated_at",
].join(", ");
