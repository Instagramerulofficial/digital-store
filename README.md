# Digital Store

A production-ready platform for **creating, managing, and selling AI-generated digital products** — built with **Next.js 15 (App Router) + TypeScript + TailwindCSS + Supabase + Stripe + Resend + OpenAI + @react-pdf/renderer**.

- **AI product generator**: type a brief (topic, niche, audience, tone, price range), get a complete sellable product — title, sales copy, outline, full content, FAQ, CTA, tags.
- **5 product types** supported: eBook, checklist pack, prompt pack, template bundle, mini-course + workbook.
- **PDF export** rendered server-side via `@react-pdf/renderer` and uploaded to a private Supabase Storage bucket.
- **Regenerate any section** (title / description / outline / content / FAQ / tags / CTA) — every run is versioned in `product_versions`.
- **Modern UI** with full **dark / light mode** (click the sun/moon in the navbar).
- **Secure downloads** via 24h signed URLs against a private Supabase Storage bucket — files are never public.
- **Stripe webhook** creates orders + access grants, then Resend sends a receipt email with download links.
- **Admin panel** with analytics, products CRUD, AI generator, and orders list.
- Strongly typed, with loading / empty / error states throughout.

---

## ✨ Feature checklist

- [x] Home with hero, featured products, categories preview, and CTA section
- [x] Products page with **search**, **category filter**, **sort**, responsive grid
- [x] Product detail page with title, description, image, price, category, add-to-cart, **related products**
- [x] Cart page using `CartContext` (localStorage) with **quantity +/-** and remove
- [x] Supabase auth: sign up, log in, auth callback, protected `/dashboard`
- [x] Dashboard: purchased products + order history + download links for owned products only
- [x] Admin area restricted to admin users (profile flag OR `ADMIN_EMAILS`)
- [x] Admin overview cards + products CRUD + orders list
- [x] Stripe Checkout session creation
- [x] Stripe webhook that verifies signatures, creates orders, grants access
- [x] Secure signed-URL download route that checks ownership first
- [x] Resend purchase confirmation email with download links
- [x] Full `schema.sql`: `profiles`, `products`, `orders`, `order_items`, `purchases`, admin role, RLS, `updated_at` triggers
- [x] Realistic demo seed data
- [x] **Marketing & Sales Agent**: auto-drafted posts (Twitter / LinkedIn / Telegram / Email / Reddit), Telegram auto-posting, email newsletter (Resend), abandoned-cart recovery, low-performer suggestions, admin approval dashboard at `/admin/agent`
- [x] Cron-driven runner at `GET /api/cron/agent` (scheduled posts + recovery emails + suggestions scan)

---

## 🧱 Project structure

```
digital-store/
├── supabase/
│   ├── schema.sql                      # Tables + RLS + triggers (base store)
│   ├── migrations/
│   │   ├── 0002_ai_generator.sql       # AI-generator tables
│   │   └── 0003_agent.sql               # Marketing agent tables
│   └── seed.sql                        # Demo products
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home
│   │   ├── products/page.tsx           # Listing + filters
│   │   ├── products/[slug]/page.tsx    # Detail + related
│   │   ├── cart/page.tsx
│   │   ├── checkout/success/page.tsx
│   │   ├── checkout/cancel/page.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── dashboard/page.tsx          # Purchases + order history
│   │   ├── admin/page.tsx              # Overview + analytics + CRUD + orders
│   │   ├── admin/generate/page.tsx     # AI product generator (form)
│   │   ├── admin/products/[id]/edit/   # Edit / regenerate / publish
│   │   └── api/
│   │       ├── checkout/route.ts       # Creates Stripe session
│   │       ├── webhook/route.ts        # Stripe webhook handler
│   │       ├── download/[productId]/route.ts   # Secure signed URL
│   │       ├── admin/products/route.ts # Product CRUD + file upload
│   │       ├── admin/generate/route.ts # POST: generate AI draft
│   │       └── admin/products/[id]/{regenerate,publish}/route.ts
│   ├── components/
│   │   ├── Navbar.tsx                  # With theme toggle
│   │   ├── Footer.tsx
│   │   ├── ProductCard.tsx
│   │   └── Toaster.tsx
│   ├── context/CartContext.tsx
│   ├── lib/
│   │   ├── supabase/{client,server,admin,middleware}.ts
│   │   ├── ai/
│   │   │   ├── openai.ts               # Typed generate() + regenerateSection()
│   │   │   └── prompts.ts              # System + user prompts per product type
│   │   ├── pdf/
│   │   │   ├── renderer.ts             # renderProductPdf() → Buffer
│   │   │   ├── common.tsx              # Cover page, markdown, footer
│   │   │   ├── theme.ts
│   │   │   └── templates/{ebook,checklist,prompt-pack,template-bundle,mini-course}.tsx
│   │   ├── stripe.ts
│   │   ├── email.ts
│   │   ├── auth.ts
│   │   ├── env.ts
│   │   └── utils.ts
│   ├── types/db.ts
│   └── middleware.ts                   # Supabase session refresh
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Getting started

### 1. Install dependencies

```bash
cd digital-store
npm install
```

### 2. Create a Supabase project

1. <https://supabase.com> → **New project**
2. Go to **Settings → API** and copy:
   - `Project URL`
   - `anon` public key
   - `service_role` secret key
3. Go to **Storage → New bucket**, name it **`products`**, **Public: OFF**.
4. Go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
5. Run [`supabase/migrations/0002_ai_generator.sql`](./supabase/migrations/0002_ai_generator.sql) in the same SQL editor. It adds the tables needed by the AI generator (`categories`, `product_versions`, `generated_assets`, `downloads`) and extends `products` with `product_type`, `subtitle`, `outline`, `faq`, `tags`, `call_to_action`, etc.
6. Run [`supabase/migrations/0003_agent.sql`](./supabase/migrations/0003_agent.sql) to add the **marketing-agent** tables (`agent_posts`, `newsletter_subscribers`, `abandoned_checkouts`, `agent_suggestions`).
6. (Optional demo data) Run [`supabase/seed.sql`](./supabase/seed.sql). Note: the seed references file paths under `files/…zip` in the bucket — either upload placeholder files at those paths, or edit the paths in `seed.sql` to point at files you uploaded.

### 3. Create a Stripe account

1. <https://dashboard.stripe.com> → grab your test **secret key** (`sk_test_…`) and **publishable key** (`pk_test_…`).
2. The webhook signing secret is configured in step 6.

### 4. Create an OpenAI API key (for the AI generator)

1. <https://platform.openai.com> → **API keys** → **Create new secret key**.
2. Add funds (gpt-4o-mini is ~$0.15/1M input tokens, a full product usually costs a few cents).
3. Paste the key into `OPENAI_API_KEY` in `.env.local`. You can switch models via `OPENAI_MODEL` (default: `gpt-4o-mini`).

### 4b. (Optional) Create a Resend account

1. <https://resend.com> → **API Keys** → create one.
2. Verify a sending domain, or use Resend's sandbox sender for local testing.
3. If you skip this, orders still complete — receipt emails are just logged to the console.

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your keys (everything you need is in `.env.example`, commented per section).

### 6. Start the Stripe webhook forwarder (local dev)

In a **separate terminal**:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
```

It prints a line like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxx
```

Copy that `whsec_…` value into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then start the dev server.

### 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

### 8. Create an admin account

1. Visit `/signup` and register using an email you listed in `ADMIN_EMAILS`.
2. (If Supabase email confirmations are on: Supabase → Auth → Providers → Email → turn "Confirm email" OFF for dev, or click the link in the email.)
3. Visit `/admin` — the first load auto-promotes your profile to `is_admin = true`.

### 9. Generate your first product with AI

1. From `/admin`, click **Generate with AI** (top-right).
2. Pick a product type, describe your topic / niche / audience, set a price range, and click **Generate**. It takes 20-60s.
3. You'll land on the **editor** — review the outline, chapters / checklist / prompts / templates / lessons, and regenerate any section that doesn't fit.
4. Click **Publish product** — a PDF is built from the current version, uploaded to the private bucket, and the product is listed on the storefront.

### 10. Test a purchase end-to-end

1. Visit the product, add to cart, checkout.
3. Use the Stripe test card **`4242 4242 4242 4242`** with any future expiry and any CVC.
4. Your `stripe listen` terminal should log `checkout.session.completed`. An `orders` row is created, a `purchases` grant is added, and a receipt email is sent (or logged).
5. Go to `/dashboard` — your purchased product is listed with a working **Download** button.

---

## 🔑 Where to paste your API keys

All keys live in **one file**: `.env.local` (created by copying `.env.example`).

| Variable | Comes from | Where |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | Project → Settings → **API** |
| `SUPABASE_PRODUCTS_BUCKET` | You | Name of the storage bucket you created (default: `products`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI platform | [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Default model is `gpt-4o-mini`. |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard | Developers → **API keys** |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI | Output of `stripe listen --forward-to …/api/webhook`; in production, from **Webhooks → Add endpoint** |
| `RESEND_API_KEY` | Resend dashboard | **API Keys** |
| `EMAIL_FROM` | You | A sender address for your verified Resend domain, e.g. `"Digital Store <noreply@yourdomain.com>"` |
| `ADMIN_EMAILS` | You | Comma-separated list, e.g. `you@example.com,other@example.com` |
| `NEXT_PUBLIC_SITE_URL` | You | `http://localhost:3000` locally, `https://yourdomain.com` in production |
| `TELEGRAM_BOT_TOKEN` | @BotFather in Telegram | `/newbot` → token. Optional — leave empty to disable Telegram posting. |
| `TELEGRAM_CHANNEL_ID` | Telegram channel admin | `@your_channel_username` or `-100…` numeric id. Add the bot as **admin** with *Post messages* permission. |
| `CRON_SECRET` | You | Long random string. The agent cron at `/api/cron/agent` checks `Authorization: Bearer ${CRON_SECRET}`. |

You do **not** need to paste keys anywhere else — every other file reads from `.env.local` through `src/lib/env.ts`.

---

## 🤖 Marketing & Sales Agent

Once `OPENAI_API_KEY` is set, publishing a product automatically generates **draft marketing posts** for every channel (Twitter/X, LinkedIn, Telegram, Email, Reddit). You review and approve them at **`/admin/agent`** — no content goes out without your click.

### What it does

| Feature | Status | How it runs |
| --- | --- | --- |
| Draft per-channel copy on publish | Automatic | Background job inside `/api/admin/products/[id]/publish` |
| **Telegram** auto-post on approval | Automatic | Requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` |
| **Email newsletter** to subscribers | Automatic | Requires `RESEND_API_KEY`; adds a one-click unsubscribe link |
| Twitter / LinkedIn / Reddit posts | Draft only | Copy-paste from the queue (avoids API approval pain) |
| Abandoned cart recovery email | Automatic | Pending Stripe sessions older than 24h get one follow-up |
| Low-performer suggestions | Automatic | Products published 14+ days with 0 sales appear in "Suggestions" |
| Scheduled posts | Automatic | Set `scheduled_at` on any approved post; cron dispatches on time |

### Setup (optional, in this order)

1. **Telegram** — talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token to `TELEGRAM_BOT_TOKEN`.
   - Create a channel, open it, **Administrators → Add Admin**, invite your bot, tick *Post Messages*.
   - Paste the channel id into `TELEGRAM_CHANNEL_ID` (e.g. `@my_products` or `-1001234567890`).
2. **Email** — the agent reuses your existing Resend setup. Once someone signs up via the widget on `/`, the next approved `email` post is sent to them.
3. **Cron** — schedule `GET https://yourdomain.com/api/cron/agent` every hour with header:
   ```
   Authorization: Bearer <your CRON_SECRET>
   ```
   Options:
   - **Vercel Cron** — add to `vercel.json`:
     ```json
     { "crons": [{ "path": "/api/cron/agent", "schedule": "0 * * * *" }] }
     ```
     then set `CRON_SECRET` in Vercel env and forward it via the project settings (Vercel cron requests already carry an `Authorization` header if you configure one in the dashboard).
   - **cron-job.org** / **GitHub Actions** — any HTTP scheduler works, just include the header.

### Safety defaults

- The agent never posts without admin approval. `status=draft` → you click **Approve** (or **Post now**).
- If any API is missing (`OPENAI_API_KEY`, `TELEGRAM_*`, `RESEND_API_KEY`), the feature degrades gracefully — drafts are still created, dispatch is skipped.
- Emails always include a `List-Unsubscribe` header + visible unsubscribe link (token-based, no auth needed).

---

## 💳 Stripe → IBAN payouts

Revenue flows: **customer → Stripe Checkout → your Stripe balance → payout to your IBAN** (2–7 business days depending on country).

Nothing in this codebase needs your IBAN. The routing happens **once** in the Stripe Dashboard:

1. **Settings → Business → Bank accounts & payouts → Add bank account**.
2. Select your country (e.g. Romania), choose **IBAN**, paste `RO..` / account holder name.
3. Verify with a micro-deposit or bank login if prompted.
4. Set **Payout schedule** (daily / weekly / manual).
5. Complete the Stripe onboarding checklist (ID + business info) — without it, payouts stay held.

After that, every successful purchase in this store automatically contributes to the next payout. You'll see each transfer in **Stripe → Payments → Payouts**, and the money lands on the IBAN you set.

---

## 🎨 Files to open first to customize branding

- `src/app/layout.tsx` — page title and meta description
- `src/components/Navbar.tsx` — logo mark and store name
- `src/components/Footer.tsx` — footer copy
- `src/app/page.tsx` — hero copy, feature blurbs, CTA section
- `tailwind.config.ts` — the `brand` color palette (currently purple)
- `src/app/globals.css` — light/dark CSS variables and base component styles

---

## 🔐 Security model

- The `products` storage bucket is **private**. No URL is ever exposed publicly.
- `/api/download/[productId]` is the only way to retrieve a file:
  1. Requires an authenticated Supabase session.
  2. Checks that a row exists in `purchases` for this `(user_id, product_id)`.
  3. Generates a **5-minute signed URL** using the service-role key.
  4. Increments `download_count` for auditing.
- The Stripe webhook **verifies the signature** with `STRIPE_WEBHOOK_SECRET` and is **idempotent** (checks `stripe_session_id` uniqueness before inserting).
- **Row Level Security** is enabled on all tables. Users read only their own orders / purchases; admins see everything.
- The `service_role` key is used **only server-side** (`src/lib/supabase/admin.ts`) — never shipped to the browser.

---

## 🚢 Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add all the env vars from your `.env.local` to the Vercel project settings — set `NEXT_PUBLIC_SITE_URL` to your production URL.
4. In **Stripe Dashboard → Developers → Webhooks → Add endpoint**:
   - URL: `https://yourdomain.com/api/webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret into Vercel's `STRIPE_WEBHOOK_SECRET`.
5. Redeploy.

---

## 🛠 npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at `localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Start the built production server |
| `npm run lint` | Lint the codebase |
| `npm run stripe:listen` | Shortcut for `stripe listen --forward-to localhost:3000/api/webhook` |

---

## 🧪 Tech stack

- Next.js 15 (App Router, Server Components, React 19)
- TypeScript
- TailwindCSS (dark mode via `class`)
- Supabase (Postgres + Auth + Storage)
- Stripe Checkout + Webhooks
- Resend (transactional email)
- Zod (request validation)

Happy selling!
