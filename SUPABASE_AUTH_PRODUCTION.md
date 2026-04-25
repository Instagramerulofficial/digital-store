# Supabase auth – production checklist

Manual changes you have to make in the Supabase dashboard before the
first production deploy. None of these can be configured from code or
env vars.

> Project: `uccbibvpetbkiiyxueld`
> Dashboard: <https://supabase.com/dashboard/project/uccbibvpetbkiiyxueld>

Replace `https://YOUR-DOMAIN.com` below with your real Vercel
production domain (the same value you set for `NEXT_PUBLIC_SITE_URL`
in Vercel).

---

## 1. Auth → URL Configuration

`Dashboard → Authentication → URL Configuration`

### Site URL

Set to:

```
https://YOUR-DOMAIN.com
```

This is what Supabase uses as the default `redirect_to` and as the
base for links in transactional emails (confirm signup, magic link,
password reset, etc.).

### Redirect URLs (allow-list)

Add **all** of the following. Supabase will reject any callback that
does not match one of these patterns, so missing one breaks login on
that environment.

```
http://localhost:3000/auth/callback
https://YOUR-DOMAIN.com/auth/callback
https://*-YOUR-VERCEL-TEAM.vercel.app/auth/callback
```

Notes
- Keep `http://localhost:3000/auth/callback` so local dev keeps
  working.
- The `*-YOUR-VERCEL-TEAM.vercel.app` wildcard covers Vercel preview
  deployments. Replace `YOUR-VERCEL-TEAM` with the slug Vercel shows
  in your preview URLs (e.g. `digital-store-git-main-alecu.vercel.app`
  → wildcard `https://digital-store-*-alecu.vercel.app/auth/callback`).
- If you don’t use previews, drop that line.

---

## 2. Auth → Email Templates

`Dashboard → Authentication → Email Templates`

For **every** template (Confirm signup, Magic Link, Reset password,
Change Email, Invite user) verify that the action link uses
`{{ .SiteURL }}` (which now points at the production domain) and
**not** a hard-coded `localhost` URL.

If you customised any template earlier with a literal URL, edit it
back to the default form, e.g.:

```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

`{{ .ConfirmationURL }}` and `{{ .SiteURL }}` are derived from the
Site URL above, so once step 1 is correct the emails self-heal.

---

## 3. Auth → Providers

`Dashboard → Authentication → Providers`

For each provider you have enabled (Google, GitHub, etc.), open the
provider settings:

1. Make sure the **Callback URL** shown by Supabase
   (`https://uccbibvpetbkiiyxueld.supabase.co/auth/v1/callback`) is
   registered in the provider's developer console (Google Cloud
   Console, GitHub OAuth Apps, etc.). This URL is the same in dev
   and prod — it points at Supabase, not at your site — so it should
   already be set, but double-check.
2. If you only ever used the provider in test mode, switch the
   provider to production / publish the OAuth app in its own console
   (Google: "Publishing status → In production").

The redirect_to that Supabase appends to the provider URL goes back
to the Site URL set in step 1, so as long as steps 1 + 3 are aligned,
OAuth works.

---

## 4. Storage → products bucket

`Dashboard → Storage → products`

- Privacy: **Private** (toggle off "Public bucket"). The download
  endpoint refuses to serve files if this bucket flips to public —
  see `src/lib/supabase/storage.ts` and `SECURITY_STATUS.md`.
- No bucket-level public policies. The only access is via the
  service-role key from `/api/download/[productId]`.

---

## 5. Database → migrations applied

Confirm migration `0004_lockdown_product_files.sql` is applied on the
production project (`uccbibvpetbkiiyxueld`). Quick check in SQL editor:

```sql
select has_column_privilege('anon',           'public.products', 'file_path', 'select') as anon_sees_file_path,
       has_column_privilege('authenticated',  'public.products', 'file_path', 'select') as auth_sees_file_path;
```

Both columns must return `false`. If either returns `true`, re-run
the migration and then `notify pgrst, 'reload schema';`.

---

## 6. Database → backups

`Dashboard → Database → Backups`

- Confirm Daily backups are enabled (default on Pro plan).
- Optionally, take a manual snapshot now and label it `pre-go-live`.

---

## What stays the same in code

You do **not** need to change anything in `src/middleware.ts`,
`src/lib/supabase/server.ts`, `src/app/auth/callback/route.ts` or any
other Supabase client. The callback route uses `origin` from the
incoming request URL, so it self-adapts to any host (`localhost`,
preview URL, prod URL) — provided that host is in the Supabase
Redirect URLs allow-list (step 1).

---

## Smoke test after the change

After saving the URL configuration:

1. Sign up with a fresh email on production.
2. Open the confirmation email — the link domain must be your prod
   domain, not `localhost`.
3. Click it; you should land on `/dashboard` logged in.
4. Sign out, then sign back in with an admin email; verify `/admin`
   loads.
