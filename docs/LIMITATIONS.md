# Limitations and honest status

This project implements the requested platform, but several things are
deliberately incomplete, environment-limited, or unverified. This file exists so
nothing here is mistaken for a finished production deployment.

---

## 1. Database

- **SQLite is the active database in this workspace.** PostgreSQL and Docker are not installed locally.
- Production runs on PostgreSQL (Supabase, project `ynaziaxxrpszmefykupv`, region `eu-central-1`). The baseline migration `20261029000000_init_postgres` **has been applied**: 26 tables plus `_prisma_migrations` exist, and all tables are empty.
- A PostgreSQL variant of the schema is generated from `prisma/schema.prisma` by `npm run schema:pg`; `npm run schema:pg:check` fails if it is stale.
- The local migrations under `prisma/migrations/` are **SQLite-specific**. Do not apply them to PostgreSQL.
- There is no SQLite → PostgreSQL data migration. Launching on an empty database and entering real data in the admin UI is the intended path.
- The production Prisma client is generated from the PostgreSQL schema with `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for AWS Lambda (Netlify/Vercel). This changes the client in `node_modules`; run `npm run db:sqlite:generate` afterwards to restore local development.
- Search uses `contains` with `mode: "insensitive"` on PostgreSQL (SQLite rejects that option), selected from `DATABASE_URL` in `src/lib/db-search.ts`. It has been exercised against the production database only indirectly (catalog pages render); a full-text search quality review was not done.
- SQLite data was not migrated to PostgreSQL.
- `Int` money columns are 32-bit. That is ample for eSIM prices but caps individual amounts around 21 million TRY.

## 2. Telegram
- A real bot (`@i4abnet_store_bot`) is configured in the local `.env`, and the local `getUpdates` bridge was tested: `/start` handling, webhook secret, and admin order notifications (including the coupon/discount lines) work.
- The **public webhook** was not registered and not tested. Telegram Mini App buttons require an HTTPS origin, so they are omitted locally; Mini App customer linking and Mini App admin login remain unverified until the app is served over HTTPS.
- Webhook authentication, duplicate handling, invalid `initData` rejection, callback parsing, and permission checks are covered by code and partial local tests, but full real-Telegram flows (Mini App, customer linking) remain unverified.
- Notifications are best-effort and at-least-once; duplicate sends are possible.
- There is no email or SMS notification channel.

## 3. Payments and coupons
- Only **manual bank transfer** and optional **cash on delivery** are implemented.
- There is no online card payment, payment gateway, 3-D Secure, or automatic reconciliation.
- Bank details in the seed are fake (`DEMO BANK — replace in settings`, placeholder IBAN). They must be replaced.
- Payment confirmation is a manual admin decision based on an uploaded receipt.
- Receipts are stored on local disk in development and in the Supabase `private` bucket in production. The Supabase Storage adapter has been verified against the real buckets (upload → fetch → read → delete). There is no virus scanning or OCR.
- No refunds are executed automatically; marking an order refunded only records the state.
- Coupons are single-code, single-use-per-order; stacking, product/category scoping, and automatic "first order" targeting are not implemented.
- The per-customer limit is counted by normalized phone number, not by account or Telegram ID, so a customer using a different phone can redeem again.
- Coupon schedules are entered in Europe/Istanbul time; there is no per-coupon timezone setting.
- Deleting a coupon that was used by any order is blocked; disabling it is the intended alternative.
- There is no bulk coupon generation, import/export, or expiry notification.
- Coupon usage is only released on cancellation or reservation expiry; a delivered then refunded order keeps its usage count.

## 4. Demo data
- The seed inserts demo categories, products, banners, inventory (`DEMO-ONLY-*`), and settings.
- Demo content is clearly labelled but is **not** a real catalog.
- There is no one-click purge. Remove or replace demo data before launch, or start production from an empty database.
- No owner account is seeded; the first owner is created through setup.

## 5. PWA
- The manifest, icons, service worker, and offline page are implemented.
- Installability, service-worker updates, and offline behaviour were **not verified in a real browser on an HTTPS deployment**.
- The service worker intentionally avoids caching API, admin, cart, checkout, and order pages. Offline mode is therefore limited to previously visited public pages and static assets.
- There is no background sync or offline order submission.

## 6. Browser and end-to-end testing
- There is no Playwright/E2E suite. The former `e2e` script was removed because it had no config or tests.
- Owner setup and login were not exercised through a real browser; owner pages were tested with temporary sessions on a disposable database.
- Client-side cart hydration, RTL layout edge cases, keyboard navigation, and screen-reader behaviour were not systematically tested.
- No cross-browser matrix (Safari, Firefox, mobile) was run.

## 7. Security gaps
- **No Content-Security-Policy.** Other security headers are set.
- **No MFA/TOTP**, self-service/email password reset, password change UI, or email verification. A forgotten admin password can be reset from the server with `npm run admin:reset-password` (see README); this revokes existing sessions.
- **No account lockout** beyond the in-process rate limiter.
- Rate limiting is **per process**, not shared across instances.
- Server actions rely on Next.js same-origin protections and `SameSite=Lax` cookies; there is no separate CSRF token.
- Private files are on local disk in development and in a private Supabase bucket in production; there are no signed URLs (files are streamed by authorized route handlers) and no encryption at rest beyond the provider's defaults. The Supabase adapter has been verified against the real buckets.
- Audit logs are database rows, not tamper-evident (a database administrator can alter them).
- No automated PII deletion/anonymization; retention policy text is informational.
- No WAF, DDoS protection, intrusion detection, or malware scanning.
- No independent penetration test or security audit was performed.
- Dependencies: `npm audit` still reports **3 high-severity advisories in the Prisma CLI dependency `deepmerge-ts`** (development-time config merging). Fixing it requires Prisma 7, a breaking major upgrade. `npm audit` also reports advisories for Vitest's `tinypool`/`@vitest/mocker` (test-runner only, not shipped at runtime). PostCSS was overridden to a patched version and the production build passes.
- The app trusts `X-Forwarded-For` for rate limiting and audit IPs. The reverse proxy must overwrite it.

## 8. Operations

- **A hosted deployment exists:** <https://4abnet.netlify.app> (Netlify site `3732891f-7dd4-401b-a898-6ba7d35ace06`), with Supabase Postgres + Storage. There is no custom domain and no Git remote; deploys are CLI-only (`npx netlify-cli deploy --prod --build`).
- Netlify's free plan is a hard 300 credits/month: roughly 20 production deploys, ~15 GB of bandwidth, and ~1.5M requests shared between them. When credits run out the site is paused until the next cycle.
- Vercel's Hobby plan is not an option for a store: its fair-use guidelines require a paid plan for any site that processes payments or advertises products.
- Supabase's free database (500 MB) pauses after 7 days without activity; the daily maintenance cron is intended to prevent that, but this has not been observed.
- No Docker image, Kubernetes manifests, or infrastructure-as-code are included.
- No automated backup job or restore automation is included; the procedures are documented only.
- No health-check endpoint or metrics exporter is included.
- No email delivery (order confirmations, receipts) is implemented.
- No invoice generation; `InvoiceSequence` exists in the schema but is unused.
- The `AdminLoginToken` helper/model is unused; the Mini App login route creates a normal admin session after verifying `initData`.
- No multi-currency support; TRY is fixed.
- No multi-warehouse or supplier API integration; inventory is manual.
- No search engine; search uses database `contains` matching and is not full-text ranked.
- No customer accounts; customers identify themselves with reference + phone or an access cookie.
- Cart is stored in `localStorage`, so it is per-browser and not synchronized across devices.
- No automated data import/export tools for catalog or inventory beyond the admin UI and Prisma.

## 9. Content and legal
- Policy pages (privacy, terms, refund, retention) contain demo/placeholder text. They are not legal advice and must be reviewed by a qualified professional for the target jurisdiction.
- Store contact details, support hours, and bank information are placeholders until edited in settings.
- Product names and descriptions are demo data, not verified eSIM offers.
- The brand name/tagline and color are implemented, but no trademark or regulatory review was performed.

## 10. Performance
- The measured slowness reported during local use was **the Next.js development server**, not the application logic. `next dev` compiles routes on demand and serves unminified development JavaScript. On this machine, first visits measured 0.5–7.7 s per page (webpack) and about 1–2 s per new route with Turbopack; repeat visits were about 0.5–0.9 s.
- The same pages under the production build (`npm run build && npm start`) measured **15–90 ms** server time, with the homepage HTML at about 36 KB gzipped. Production is the correct mode for evaluating speed or showing the site to anyone.
- Pages are rendered dynamically (settings, locale header, cookies), so responses are `no-store` and not CDN-cacheable as written. At this catalog size the database work is negligible; a larger catalog would need caching/ISR.
- `getSettings()` and `getVisibleCategories()` are deduplicated per request with React `cache()`, so a layout and its page share one query each.
- Not benchmarked: high concurrency, slow networks, mobile devices, a PostgreSQL deployment, or serverless cold starts. The numbers above are local desktop measurements.

## 11. Verification summary

| Item | Status |
| --- | --- |
| Type check | Passes |
| Unit tests | 74/74 pass |
| Production build | Passes |
| SQLite migrations | Applied, up to date |
| PostgreSQL schema | Generated and validated; baseline migration applied to Supabase (26 tables) |
| Supabase Storage adapter | Verified against the real `media` / `private` buckets |
| Netlify deployment | Live at `https://4abnet.netlify.app`; all routes and static assets 200 |
| Storefront/admin smoke tests | Performed on a temporary DB |
| Concurrent reservation | 8 simultaneous orders / 6 units: no oversell |
| Coupons | Unit + smoke tested (math, limits, concurrency, admin CRUD, display) |
| PostgreSQL | Baseline migration applied; full CRUD flow not exercised on production data |
| Real Telegram | Local bot + bridge verified; public webhook/Mini App not registered yet |
| Real browser E2E | Not run |
| Browser console | Storefront + all admin pages checked in dev, and the deployed storefront checked live: no errors or failed requests |
| Performance | Dev 0.5–7.7 s/route; production build 15–90 ms/route (local desktop) |
| PWA install/offline | Not verified on HTTPS |
| Security audit/penetration test | Not performed |
| Backups/restore drill | Not performed |

If you need any of the above for launch, treat it as remaining work rather than
assuming it is covered.