# 4AB NET

Multilingual eSIM storefront with manual bank-transfer checkout, manual eSIM
inventory, order tracking, and a permissioned admin dashboard.

**Tagline:** إنترنت بضغطة زر
**Brand color:** `#FA8F40`
**Currency:** Turkish lira (TRY / ₺)
**Languages:** Arabic (default, RTL), English, Turkish (LTR)

---

## What is implemented

### Storefront

- Database-driven homepage: banners, hero copy, offers, features, categories, featured products.
- Category listing, product listing with search/sort/filter, product details with AR/EN/TR translations and fallback.
- Cart persisted in `localStorage`; the server re-prices every line and re-checks stock at checkout.
- Checkout with name, phone, payment method (bank transfer / cash on delivery when enabled), and customer note.
- Discount coupons: apply a code at checkout with server-side re-validation and an itemised discount line.
- Manual bank-transfer flow: bank instructions, receipt upload, payment review status.
- Order tracking by reference + phone, plus a signed HttpOnly access cookie after creation.
- Order page shows status history and — only for authorized viewers — assigned eSIM delivery details.
- Support, privacy, terms, refund, and tracking pages; all editable content is stored in settings.
- Locale routing under `/[locale]` with persisted language choice and correct `lang`/`dir`.
- Installable PWA with manifest, icons, and a conservative service worker.

### Admin

- First-owner setup at `/[locale]/admin/setup` (only while no owner exists).
- Email/password login with scrypt hashing, hashed session tokens, HttpOnly cookies, expiry, and revocation.
- Owner-created invitations with one-time acceptance links.
- Granular server-side permissions; the owner bypasses permission checks.
- Owner-only administrator management; owner accounts cannot be suspended, deleted, or have permissions edited.
- Product/category/banner CRUD with trilingual fields and public image uploads.
- Discount coupons: percentage or fixed amount, minimum order, discount cap, total and per-customer usage limits, scheduled start/expiry (Europe/Istanbul), enable/disable, and usage counters.
- Manual eSIM inventory: create units, revoke, release expired reservations, assign, and deliver.
- Order queue, order detail, status transitions, payment review, internal notes, receipt viewing.
- Customers list, audit log, 30-day reports, store/content/settings management.
- Telegram status panel, notification retry, and admin sign-in through a Telegram Mini App (when configured).

### Platform

- Prisma schema with indexes, relations, and transactional order/inventory operations.
- Integer minor-unit money (`Int`), no floating point in totals.
- Historical order snapshots (customer name/phone, product name, price, allowance, validity).
- Private receipt and delivery files outside the web root, streamed only through authorized routes.
- Audit logging for privileged actions.
- Unit tests, type checking, and a production build that pass locally.
- Documentation for architecture, deployment, backups, Telegram, security, testing, and limitations.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15.5.28 (App Router, server actions, route handlers) |
| UI | React 19.1, TypeScript 5.9, Tailwind CSS 4.3 |
| Data | Prisma 6.19.3 |
| Database (local development) | SQLite (`data/dev.db`) |
| Database (production) | PostgreSQL on Supabase free plan |
| File storage (production) | Supabase Storage (`media` public, `private` private) |
| Hosting (production) | Netlify free plan (`https://4abnet.netlify.app`) |
| Auth | Custom scrypt password hashing + opaque session tokens stored as SHA-256 hashes |
| Validation | Zod 4.6 |
| Tests | Vitest 3.2 |
| PWA | Hand-written manifest + service worker |

> **Database note:** local development uses SQLite because neither PostgreSQL nor
> Docker is installed in this environment; the schema avoids SQLite-only
> features. Production runs on PostgreSQL: `prisma/postgres/schema.prisma` is
> generated from the source schema by `npm run schema:pg`, and the baseline
> migration `20261029000000_init_postgres` has been applied to the Supabase
> project (26 tables). The committed migrations under `prisma/migrations/` are
> SQLite-specific and must not be applied to PostgreSQL. See
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

Generate a signing secret and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then:

```bash
npx prisma migrate deploy   # create/upgrade the database
npm run db:seed             # optional: demo catalog + demo inventory
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000/ar/admin/setup` and create the first owner account.
The setup page refuses to run once an owner exists.

### Deploying

Production uses **Netlify (free) + Supabase (Postgres + Storage)** and is live at
<https://4abnet.netlify.app>. The full walkthrough is in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Netlify's free plan allows commercial
projects; Vercel's Hobby plan does not.

Deploy with a full build — `npx netlify-cli deploy --prod --build`. Do **not**
use `--no-build`: it skips the Next.js runtime's publish step and every
`/_next/static/*` asset 404s.

### Development vs. production speed

`npm run dev` compiles each route on first visit and ships unminified development
JavaScript. On this machine that measured **0.5–7.7 s per page** (first visit to
a route is the slowest), which is normal for the Next.js dev server and is
**not** representative of the deployed site. The production build measured
**20–90 ms per page** for the same routes.

Use the production build whenever you want to evaluate real speed:

```bash
npm run preview     # build + start on http://localhost:3000
```

Keep `npm run dev` (or `npm run dev:fast`, which uses Turbopack) only while
editing code. Restart the server after switching modes. Note that production sets
the admin session cookie with the `Secure` flag: it works on `http://localhost`
and on HTTPS origins, but not over a plain-HTTP LAN address.

### Forgot the admin password?

There is no email reset flow. From the machine that holds the database:

```bash
npm run admin:reset-password
```

It asks for the new password twice (hidden input), or you can pass it directly:

```bash
npm run admin:reset-password -- --email owner@example.com --password "a long new password"
```

If no `--email` is given it targets the owner account. The reset revokes all
existing sessions for that administrator and writes an audit-log entry. The
password must be 12–200 characters.

### Demo data warning

`npm run db:seed` inserts:

- 6 categories and 8 products with AR/EN/TR content, explicitly labelled as demo data;
- 2 banners;
- 6 inventory units per product with codes prefixed `DEMO-ONLY-`;
- default store settings, including **demo bank details** (`DEMO BANK — replace in settings`, placeholder IBAN).

None of these are real products, activation codes, or payment details. Replace
them before selling. The admin settings page displays warnings while the demo
bank data is present.

No owner account, real credential, or Telegram token is seeded.

---

## Environment variables

See [`.env.example`](.env.example). Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma connection string. SQLite: `file:../data/dev.db`. PostgreSQL: `postgresql://...` |
| `APP_SECRET` | Yes | HMAC key for order-access cookies. Use 32+ random bytes. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public origin, no trailing slash. Used for Telegram Mini App URLs. |
| `TELEGRAM_BOT_TOKEN` | No | Enables Telegram notifications and Mini App login. |
| `TELEGRAM_WEBHOOK_SECRET` | No | Must match the `secret_token` registered with Telegram. |
| `TELEGRAM_ADMIN_CHAT_ID` | No | Chat that receives new-order notifications. |
| `TELEGRAM_BOT_USERNAME` | No | Bot username shown in the customer linking UI. |
| `CRON_SECRET` | Recommended | Bearer secret for `/api/cron/maintenance`. |
| `MAX_UPLOAD_MB` | No | Upload ceiling (default 4 MB; platform bodies cap at ~6 MB on Netlify, 4.5 MB on Vercel). |
| `SUPABASE_URL` | Production | Supabase project URL. Server-only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Storage key that bypasses RLS. Server-only, never `NEXT_PUBLIC_`. |
| `SUPABASE_PUBLIC_BUCKET` | No | Public image bucket (default `media`). |
| `SUPABASE_PRIVATE_BUCKET` | No | Private file bucket (default `private`). |
| `DIRECT_URL` | No | Direct/session Postgres connection used only for migrations. |

With the Supabase variables empty, uploads use local disk (`public/uploads`,
`storage/private`). Setting only one of the two required Supabase variables is a
configuration error and uploads fail with `storage-misconfigured`.

Telegram values are empty in this workspace. The UI reports the integration as
**not configured**; no messages are sent.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` (SQLite) + production build |
| `npm run build:pg` | Generate the PostgreSQL client and build |
| `npm run build:netlify` | Netlify build: apply PG migrations, then `build:pg` |
| `npm start` | Start the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:deploy` | Apply committed SQLite migrations |
| `npm run db:migrate` | Create a development migration |
| `npm run db:push` | Push schema without a migration (development only) |
| `npm run db:seed` | Insert demo data |
| `npm run db:pg:deploy` | Apply PostgreSQL migrations (`DIRECT_URL` or `DATABASE_URL`) |
| `npm run db:pg:status` | Show PostgreSQL migration status |
| `npm run schema:pg` | Regenerate `prisma/postgres/schema.prisma` from the source schema |
| `npm run schema:pg:check` | Fail if the generated PostgreSQL schema is stale |
| `npm run db:sqlite:generate` | Restore the SQLite Prisma client after a PG build |
| `npm run telegram:info` | Show the bot, webhook, and local Telegram env status |
| `npm run telegram:discover` | Remove the webhook, wait for `/start`, and save chat/bot IDs to `.env` |
| `npm run telegram:bridge` | Forward Telegram updates to the local webhook route (no public URL needed) |
| `node scripts/generate-icons.mjs` | Regenerate PWA icons |

---

## Project layout

```text
prisma/
  schema.prisma                 Data model (SQLite, local development)
  migrations/                   SQLite migrations
  postgres/schema.prisma        Generated PostgreSQL schema (production)
  postgres/migrations/          PostgreSQL baseline migration
  seed.ts                       Demo data
src/
  middleware.ts                 Locale detection, admin route guard
  app/
    [locale]/
      (storefront)/             Home, catalog, cart, checkout, tracking, legal
      admin/
        (auth)/                 Login, setup, invite, Telegram login
        (dashboard)/            Protected admin pages
        actions.ts              All admin server actions
    api/                        Orders, coupons, receipts, QR, Telegram, cron
    manifest.ts                 PWA manifest
  components/                   Storefront/admin UI
  lib/                          Auth, orders, inventory, storage, i18n, Telegram
tests/unit/                     Vitest tests
storage/private/                Receipts and delivery files (not web-accessible)
public/uploads/                 Public catalog images (local development)
supabase/setup.sql              Supabase Storage buckets
netlify.toml                    Netlify build configuration
netlify/functions/              Scheduled maintenance function
docs/                           Architecture, deployment, security, etc.
```

---

## Verification status

Verified locally on this workspace:

- `npx tsc --noEmit` — passes.
- `npm test` — **74/74 tests pass**.
- `npm run build` — passes; all routes compile.
- `npm run schema:pg:check` — the generated PostgreSQL schema matches the source.
- `npx prisma validate --schema prisma/postgres/schema.prisma` — passes.
- `prisma migrate status` — database up to date.
- Runtime smoke tests on a temporary database covered storefront locales, order creation/idempotency, stock reservation, tracking cookies, receipt upload, private-file denial, cron/webhook authentication, owner vs. limited-admin authorization, suspension, delivery authorization, invalid Telegram `initData`, and concurrent reservation (8 simultaneous orders against 6 units: exactly 6 succeeded, no oversell).
- Coupon smoke tests on a disposable database: percentage/fixed math and rounding, discount cap, minimum subtotal, schedule window, disabled/unknown codes, per-customer limit, total usage limit under concurrent checkouts (1 of 3 succeeded), usage release on cancellation and on reservation expiry, fully discounted orders, `/api/coupons/validate`, order creation through the HTTP API, admin create/edit/toggle/delete through the real server actions with audit entries, and AR/EN/TR admin coupon pages.

Verified against the live deployment (`https://4abnet.netlify.app`, 2026-10-30):

- Production deploy completed: 2 functions (`___netlify-server-handler`, `maintenance`) + 3 edge functions, daily maintenance schedule registered.
- `/ar`, `/en`, `/tr`, `/ar/products`, `/ar/cart`, `/ar/checkout`, `/ar/track`, `/ar/admin/login`, `/ar/admin/setup`, legal pages, `/manifest.webmanifest`, `/offline` → **200**.
- Static assets (`/_next/static/*`, `/brand/*`, `/fonts/*`, `/icons/*`, `/sw.js`) → **200** with correct MIME types.
- `/api/cron/maintenance` without a token → **401**; `/api/telegram/webhook` without the secret header → **401**.
- Admin routes redirect to login when no session cookie is present (**307**).
- PostgreSQL connectivity confirmed from the serverless function (a coupon preview reached the database and returned `PRODUCT_UNAVAILABLE`, not a 5xx).
- Browser check: no console errors, no failed requests, RTL + Cairo font + Tailwind CSS applied, canonical and `hreflang` links correct.
- Supabase Storage round-trip (upload → fetch → read → delete) verified against the real buckets.

Verified locally with the real bot token through the `getUpdates` bridge (see
[`docs/TELEGRAM.md`](docs/TELEGRAM.md)): bot identity, `/start` handling, webhook
secret, and admin order notifications including the coupon/discount line.

Not verified:

- Public Telegram webhook delivery and Mini App flows on the deployed origin (the webhook is not registered yet).
- PWA install/offline behaviour on the deployed origin.
- Browser-driven owner setup/login (Playwright browsers are not installed); owner pages were exercised with temporary sessions on a disposable database.
- A full order placed end-to-end on production (the production database has no products or inventory yet).

See [`docs/TESTING.md`](docs/TESTING.md) and [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — routing, data model, order lifecycle, storage, auth.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production setup, PostgreSQL switch, backups, cron.
- [`docs/TELEGRAM.md`](docs/TELEGRAM.md) — bot, webhook, Mini App, notifications.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, controls, hardening checklist.
- [`docs/TESTING.md`](docs/TESTING.md) — automated tests and manual smoke checklist.
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — known gaps and honest status.
