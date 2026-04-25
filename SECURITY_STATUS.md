# Security Status — Digital Product Downloads

> Last full audit: 2026-04-25 — Supabase project `uccbibvpetbkiiyxueld`.
> Detailed findings + reasoning live in `canvases/digital-download-security-audit.canvas.tsx`.
> This file is the short, operational summary.

## TL;DR

A signed-in user with **no purchase** cannot download. An anonymous user
cannot download and cannot even discover the storage paths. The
`products` Supabase Storage bucket is private and direct object access
is denied. Verified live, end-to-end, on all 6 products that have a
`file_path` set in the database.

## What was secured

| Area | Before | After |
|---|---|---|
| `file_path` exposure (PostgREST) | `select=file_path` returned the storage map for every published row to **anonymous** callers | Column-level grants reissued via `0004_lockdown_product_files.sql` — `anon` and `authenticated` get `permission denied for table products` on any query that touches `file_path`; `service_role` keeps access |
| `file_path` exposure (RSC payloads) | `select("*")` in public pages serialized `file_path` into HTML | All public queries use `PUBLIC_PRODUCT_COLUMNS` allowlist (`src/lib/products/columns.ts`) |
| Signed URL TTL | 24 hours — link could be reshared all day | 5 minutes — `SIGNED_URL_TTL` in `src/app/api/download/[productId]/route.ts` |
| Bucket privacy | Trusted to be private; no runtime assertion | `assertProductsBucketIsPrivate()` (`src/lib/supabase/storage.ts`) — fail-closed `503` if the bucket goes missing or is flipped public |
| Per-purchase abuse | Unlimited downloads per purchase row | Soft cap `MAX_DOWNLOADS_PER_PURCHASE = 100` → `429 Too Many Requests` past the limit |
| Receipt email copy | Promised "valid for 24 hours" pointing at the secure endpoint (which mints a fresh 5-min URL on demand) | Rewritten in `src/lib/email.ts` — link is always valid, signed URL is per-click |

## Live test matrix (last run)

```
Project ref : uccbibvpetbkiiyxueld
Bucket      : products  (private)
Files       : 6/6 uploaded under files/<slug>.zip
```

| # | Test | Role | Expected | Got |
|---|---|---|---|---|
| A | `GET /api/download/<id>` | anon | 401 | **401** `You must be signed in to download.` |
| B | `GET /api/download/<id>` | logged in, no purchase | 403 | **403** `You don't own this product.` |
| C | `purchases` rows for that user | (DB check) | `[]` | `[]` — confirms B was a real gate, not a fluke |
| D1-4 | REST `select=…file_path…` on each of 6 products | anon | permission denied | **6/6 → 401** `permission denied for table products` |
| D5 | REST `select=*` on products | logged in, no purchase | `file_path` absent | **403** permission denied (whole query refused — even safer) |
| D6 | REST `select=…file_path…` on products | service_role | visible | visible — `/api/download` server flow still works |
| D7 | `GET /`, `/products`, `/products/<slug>` | anon | 200, render | **200 / 200 / 200** |
| D8 | HTML of public product page contains `file_path` / `files/<slug>` / `storage/v1/object/sign` | anon | absent | all three: **clean** |
| F  | Service-role mints signed URL + GET it | (admin client) | 200, bytes | **200**, byte-identical to source |

## How the download flow works

```
GET /api/download/[productId]
  │
  ├─ assertProductsBucketIsPrivate()      ─► bucket missing/public  ► 503
  ├─ requireUser()                        ─► no session             ► 401
  ├─ products lookup (service-role)       ─► not published          ► 404
  ├─ purchases lookup (user × product)    ─► no row                 ► 403
  ├─ download_count >= 100                ─► soft cap               ► 429
  │
  ├─ admin.storage.from('products')
  │     .createSignedUrl(file_path, 300)  ─► 5-minute signed URL
  │
  ├─ purchases.update({ download_count++ , last_downloaded_at })
  └─ 302 redirect to the signed URL
```

`file_path` only ever leaves the database via the `service_role` client
inside this route — never via PostgREST and never inside RSC HTML.

## What to do when you upload the real product files

1. Open Supabase Studio → **Storage** → bucket `products`.
2. Verify the toggle still says **Public = OFF** (it must).
3. Navigate to `files/` and upload each real archive **over** the
   placeholder, keeping the exact same filename (e.g.
   `nebula-ui-kit.zip`). The DB `file_path` column already points there.
4. (Optional) Spot-check that the upload succeeded:
   - Sign in as a user that has purchased the product.
   - Hit `/api/download/<productId>` from the browser.
   - You should get a 302 to a `…/storage/v1/object/sign/products/files/…?token=…` URL that downloads the new bytes.

The placeholders currently sitting in the bucket (`README.txt` +
`NOTES.md` zipped, ~600 B each) exist only so the secure flow can be
exercised end-to-end. They contain no sensitive data.

## Hard rules — keep these forever

- The `products` bucket **must stay PRIVATE**. Never flip the *Public*
  toggle. `assertProductsBucketIsPrivate()` will return `503` if you
  do, but you would have already broken the contract.
- Never `select("*")` against `public.products` from anon/authenticated
  context. Use `PUBLIC_PRODUCT_COLUMNS` from `src/lib/products/columns.ts`.
  Migration `0004` enforces this at the DB level — a `select("*")` from
  the browser will get `42501 permission denied for table products`.
- Never expose `file_path` (or any signed URL) in a Server Component
  that returns to the browser. Always go through `/api/download/[id]`.
- Never bypass `requireUser()` + the `purchases` row check inside the
  download route.
- If you add a new column to `public.products` that anon/authenticated
  should be able to read, append it to **both**:
  - the `grant select (...)` lists in `supabase/migrations/0004_lockdown_product_files.sql` (and reapply with `notify pgrst, 'reload schema';`)
  - the `PUBLIC_PRODUCT_COLUMNS` array in `src/lib/products/columns.ts`
- Keep `SIGNED_URL_TTL` short (current: 5 min). Do not raise it without
  a strong reason — it's the main mitigation against link sharing.
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) stays server-only.
  It must never end up in any `NEXT_PUBLIC_*` variable, in client
  components, or in commits.

## Related code & migrations

- `src/app/api/download/[productId]/route.ts` — the only legitimate path to a product file
- `src/lib/supabase/storage.ts` — bucket privacy guard
- `src/lib/products/columns.ts` — public column allowlist
- `supabase/migrations/0004_lockdown_product_files.sql` — column-level lockdown of `file_path`
- `canvases/digital-download-security-audit.canvas.tsx` — full audit report (kept on purpose)
