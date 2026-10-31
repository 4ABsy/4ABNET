# Deployment: Netlify + Supabase

This is the production deployment path for 4AB NET. It uses only free tiers:

| Layer | Service | Plan | Notes |
| --- | --- | --- | --- |
| Web app | Netlify | Free | Next.js runtime, free `*.netlify.app` subdomain, HTTPS |
| Database | Supabase | Free | PostgreSQL, 500 MB |
| File storage | Supabase Storage | Free | 1 GB, public + private buckets |
| Cron | Netlify scheduled function | Free | Daily maintenance call |

Local development keeps using SQLite and local disk.

## Live production site

| Item | Value |
| --- | --- |
| URL | <https://4abnet.netlify.app> |
| Netlify site ID | `3732891f-7dd4-401b-a898-6ba7d35ace06` |
| Netlify team | `4absy` (account `abusserat141`) |
| Supabase project | `ynaziaxxrpszmefykupv`, region `eu-central-1` |
| Database | 26 tables, migration `20261029000000_init_postgres` applied |
| Storage | buckets `media` (public) / `private` (private, 5 MB) |

Everything below has been executed against that project except the items in
[First-run checklist](#4-first-run-checklist), which need store data and the
owner account.

---

## 0. Deploy command (read this first)

Use a **full build** deploy:

```bash
npx netlify-cli deploy --prod --build
```

Do **not** use `--no-build` on this project. The Next.js runtime plugin swaps the
publish directory during `onBuild` (`onBuild` moves `.next` aside, then publishes
`.netlify/static` with `public/` + `_next/static`). With `--no-build` that step
never runs, so the deploy uploads the raw `.next` tree and every
`/_next/static/*` asset 404s while the HTML still references it.

Two other pitfalls that were hit and fixed, kept here as warnings:

- **A stray `package.json`/`node_modules` above the project** makes netlify-cli
  resolve the workspace root one directory too high, so it looks for `.next` and
  `.netlify/functions-internal` in the wrong place and deploys only the
  `maintenance` function. `outputFileTracingRoot: __dirname` in `next.config.ts`
  pins the tracing root, and the project must remain the nearest package root.
- **`outputFileTracingExcludes` globs are matched against full paths.** A pattern
  like `data/**` also matches `.../next/dist/lib/metadata/**`, which strips
  `get-metadata-route` and makes every route return 502. Local-only files are
  instead removed from the function bundle by the local plugin
  `netlify/plugins/strip-local-files` after the build.

---

## 1. Why Netlify and not Vercel

Vercel's Hobby (free) plan is explicitly restricted to **non-commercial personal
use**. Their fair-use guidelines list "any method of requesting or processing
payment from visitors of the site" and "advertising the sale of a product or
service" as commercial usage, which requires Pro ($20/month). Deploying a store
on Hobby risks the account and the deployment being paused.

Netlify's free plan has no such commercial restriction, so it is the only free
option of the two that fits a real store. The trade-off is a hard **300
credits/month** limit.

### Netlify free-tier rates

| Meter | Rate | Rough budget from 300 credits |
| --- | --- | --- |
| Production deploy | 15 credits each | ~20 deploys/month if nothing else is used |
| Bandwidth | 20 credits/GB | ~15 GB/month |
| Web requests | 2 credits/10,000 | ~1.5M requests/month |
| Function compute | 10 credits/GB-hour | depends on traffic |

Credits are shared across all meters, and when they run out **the site is paused
until the next cycle**. There is no overage on Free. Plan deploys accordingly:

- Review work on Deploy Previews (free) and merge to production only when ready.
- Keep catalog images small; images are served from Supabase Storage, which has
  its own free egress allowance, so they do not consume Netlify bandwidth.
- Watch **Team → Usage** during the first weeks.

If the store outgrows this, Netlify Personal ($9/month, 1,000 credits) or Vercel
Pro ($20/month) are the next steps. The application code does not change.

---

## 2. Supabase project

1. Create an account at <https://supabase.com> and a new project.
   - Region: closest to your customers (e.g. `eu-central-1` for Türkiye).
   - Save the database password; it is shown once.
2. Wait for provisioning to finish.

### 2.1 Connection strings

Project → **Connect** (or Settings → Database). Supabase offers three forms:

| Use | Form | Port |
| --- | --- | --- |
| App runtime (`DATABASE_URL`) | Transaction pooler | 6543 |
| Migrations (`DIRECT_URL`) | Session pooler or direct | 5432 |

Set:

```dotenv
# Transaction pooler — used by the running app on every request.
DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Session pooler (or db.<ref>.supabase.co:5432) — used only by migrations.
DIRECT_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

`?pgbouncer=true` disables prepared statements, which the transaction pooler does
not support. `connection_limit=1` keeps each serverless instance to one
connection, which matters on the free plan.

If your network cannot reach the direct host over IPv4, use the session pooler
for `DIRECT_URL` as shown. If `DIRECT_URL` is unset, migrations fall back to
`DATABASE_URL`.

### 2.2 Storage buckets

Run [`supabase/setup.sql`](../supabase/setup.sql) in the SQL editor. It creates:

- `media` — public bucket for catalog images (readable by URL);
- `private` — private bucket for payment receipts and eSIM delivery files.

No storage policies are added: the app uses the **service-role key**, which
bypasses row level security. Never add an `anon` policy to `private`.

### 2.3 Service-role key

Project → Settings → API → **service_role** key. This key bypasses RLS: it is
server-only, must never be committed, and must never be prefixed with
`NEXT_PUBLIC_`.

```dotenv
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
SUPABASE_PUBLIC_BUCKET="media"
SUPABASE_PRIVATE_BUCKET="private"
```

If only one of `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` is set, uploads fail
with `storage-misconfigured` instead of silently writing to a temporary disk.

### 2.4 Apply the schema

The PostgreSQL baseline lives in `prisma/postgres/migrations/` and is generated
from `prisma/schema.prisma` by `npm run schema:pg`.

From this workspace, with `DATABASE_URL` and `DIRECT_URL` in `.env`:

```bash
npm run db:pg:deploy     # prisma migrate deploy against DIRECT_URL
npm run db:pg:status     # should report "Database schema is up to date"
```

The Netlify build also runs `db:pg:deploy` on every deploy, so this manual step is
only needed to verify the connection before the first deploy.

### 2.5 Optional: seed demo data

Production is cleanest with an empty database and real data entered in the admin
UI. To start from the demo catalog instead:

```bash
npm run schema:pg
npx prisma generate --schema prisma/postgres/schema.prisma
DATABASE_URL="<postgres url>" npm run db:seed
npm run db:sqlite:generate        # restore the SQLite client for local dev
```

Demo inventory units are marked `DEMO-ONLY-` and bank details are placeholders.
Replace both before taking orders.

---

## 3. Netlify site

### 3.1 Deploy

**Option A — Git (recommended).** Push the repository to GitHub/GitLab, then
**Add new site → Import an existing project**. `netlify.toml` already sets:

```toml
[build]
  command = "npm run build:netlify"
  publish = ".next"
```

which applies migrations, generates the PostgreSQL Prisma client, and builds.

**Option B — CLI, no Git (this is how the live site is deployed).** From this
directory:

```bash
npx netlify-cli login
npx netlify-cli init          # create/link a site (already linked here)
npx netlify-cli deploy --prod --build
```

`--build` is required; see [section 0](#0-deploy-command-read-this-first). A
production deploy costs 15 of the 300 monthly credits. To check a change for
free, deploy a draft first (`npx netlify-cli deploy --build`) and test the
`*.netlify.app` preview URL before promoting it.

### 3.2 Environment variables

Set these in **Site configuration → Environment variables** (or
`npx netlify-cli env:set NAME "value"`). They are needed at **build** time, not
only at runtime:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler URL |
| `DIRECT_URL` | Supabase session/direct URL (migrations) |
| `APP_SECRET` | 48+ random bytes, base64url |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-site>.netlify.app` (no trailing slash) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_PUBLIC_BUCKET` | `media` |
| `SUPABASE_PRIVATE_BUCKET` | `private` |
| `CRON_SECRET` | random secret for `/api/cron/maintenance` |
| `MAX_UPLOAD_MB` | `4` |
| `TELEGRAM_BOT_TOKEN` | optional, see [`TELEGRAM.md`](TELEGRAM.md) |
| `TELEGRAM_WEBHOOK_SECRET` | optional |
| `TELEGRAM_ADMIN_CHAT_ID` | optional |
| `TELEGRAM_BOT_USERNAME` | optional |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`NEXT_PUBLIC_SITE_URL` is inlined into the client bundle at build time. If you set
it after the first deploy, trigger a new deploy (15 credits) so the Mini App URLs
and canonical links are correct.

Do not mark `NEXT_PUBLIC_SITE_URL` as a secret in Netlify: its value ends up in the
build output, which would fail secrets scanning. `netlify.toml` also excludes it
via `SECRETS_SCAN_OMIT_KEYS` as a safeguard.

`APP_SECRET` must stay stable across deploys: changing it invalidates every
customer order-access cookie (customers can still track with reference + phone).

### 3.3 Scheduled maintenance

`netlify/functions/maintenance.mjs` runs daily and calls
`/api/cron/maintenance` with `CRON_SECRET`. It releases expired reservations
(48-hour window, so daily is enough), cancels stale unpaid orders, retries failed
Telegram notifications, and prunes expired sessions.

The daily call also generates database activity, which helps avoid Supabase's
7-day inactivity pause on the free plan.

You can call the endpoint manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/maintenance
```

---

## 4. First-run checklist

1. Open `https://<site>/ar/admin/setup` and create the owner account.
2. **Admin → Settings**: replace bank name, IBAN, account holder, support contact,
   policies, and any demo content.
3. Delete or replace demo categories, products, banners, and inventory.
4. Add real inventory units for every product (activation codes / QR files).
5. Upload a catalog image in the admin and confirm it appears under
   `https://<ref>.supabase.co/storage/v1/object/public/media/...`.
6. Place a test order and upload a receipt; confirm the admin can open the receipt
   (it is streamed from the private bucket, never linked publicly).
7. Confirm `/api/cron/maintenance` without a token returns **401** (503 means
   `CRON_SECRET` is not set).
8. If Telegram is used, register the webhook and set the Mini App URL
   (see [`TELEGRAM.md`](TELEGRAM.md)); the site must be HTTPS, which it now is.
9. Check the PWA installs from the HTTPS URL and that the offline page loads.

---

## 5. Free-tier limits and what breaks first

| Limit | Value | Consequence |
| --- | --- | --- |
| Netlify credits | 300/month, hard limit | Site paused until the next cycle |
| Netlify bandwidth | ~15 GB/month within those credits | Site paused |
| Netlify deploy | 15 credits each | ~20 production deploys/month |
| Supabase database | 500 MB | Writes fail when full |
| Supabase storage | 1 GB | Uploads fail when full |
| Supabase egress | 5 GB/month | Images may be throttled/fail |
| Supabase inactivity | 7 days | Project paused (the daily cron keeps it active) |
| Serverless request body | ~6 MB (Netlify), 4.5 MB (Vercel) | Uploads above `MAX_UPLOAD_MB` are rejected |
| Function duration | 10 s (Netlify default) | Long operations must stay short |

Catalog images are the main storage/egress risk. Compress them before upload
(WebP, ~1600 px wide is plenty for a product card) and keep them well under 4 MB.

---

## 6. Backups

Supabase free includes **no automatic backups you can restore yourself**. Do this
manually:

### Database

```bash
pg_dump --format=custom --no-owner --file=4abnet-$(date +%F).dump "$DIRECT_URL"
```

Restore into an empty database:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" 4abnet-2026-10-29.dump
```

If `pg_dump` is unavailable locally, install the PostgreSQL client tools, or use
the Supabase dashboard's database export where available.

### Storage

Receipts and delivery files live in the `private` bucket and are **not**
reproducible from the database. Download them periodically (Supabase dashboard →
Storage → `private` → download, or `supabase storage cp -r`). Catalog images in
`media` can be re-uploaded from the originals you keep.

Keep at least one copy off Supabase, encrypted, and test a restore before launch.

---

## 7. Moving existing local data

The workspace database (`data/dev.db`) contains test/demo rows. There is no
automated SQLite → PostgreSQL data migration, and none is recommended for launch
data: start production empty and enter real products, inventory, and settings
through the admin UI.

If you must copy rows, export them with a script, import into PostgreSQL, and
verify row counts and monetary values (`*Minor` integer columns) afterwards.

---

## 8. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Build fails at `prisma migrate deploy` | `DIRECT_URL`/`DATABASE_URL` wrong, or IP restrictions; use the session pooler (port 5432) |
| `prepared statement "s0" already exists` | `?pgbouncer=true` missing from `DATABASE_URL` |
| `too many connections` | `connection_limit=1` missing, or several projects sharing the pooler |
| `storage-misconfigured` | only one of `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` set |
| `storage-upload-failed:400` | bucket missing (run `supabase/setup.sql`) or file type/size rejected |
| Images 404 | bucket not public, or the object was uploaded to `private` |
| Upload rejected at ~4 MB | platform body limit; lower `MAX_UPLOAD_MB` or compress the file |
| Site shows "Site not available" | Netlify credits exhausted (hard limit on Free) |
| Database errors after a week of no traffic | Supabase free project paused; restore it in the dashboard |

---

## 9. Alternative: self-hosted Linux

The application is a normal Next.js server and does not require a platform.

1. Node.js 20+, PostgreSQL 14+, a reverse proxy with HTTPS, and persistent disk.
2. Set `DATABASE_URL` to PostgreSQL, `APP_SECRET`, `NEXT_PUBLIC_SITE_URL`,
   `CRON_SECRET`. Leave the Supabase variables empty to use local disk storage
   (`public/uploads`, `storage/private`).
3. `npm ci && npm run db:pg:deploy && npm run build:pg && npm start`.
4. Reverse proxy: forward `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`; allow
   request bodies above 5 MB; never expose `storage/` or `data/`.
5. Cron every 10–15 minutes:
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/maintenance`.
6. Back up the database **and** `storage/private` (receipts and delivery files are
   not reproducible from the database).

Multi-instance deployments require shared object storage; local disk is not
shared between instances.

---

## 10. Upgrades

1. Back up the database and the private bucket.
2. Pull the new code.
3. If `prisma/schema.prisma` changed: `npm run schema:pg` and commit the
   regenerated schema **and** a new migration. Generate the migration against a
   direct/session connection (port 5432) — `prisma migrate dev` needs to create a
   shadow database:

   ```bash
   DATABASE_URL="$DIRECT_URL" npx prisma migrate dev \
     --schema prisma/postgres/schema.prisma --name <change>
   ```

   If the database user cannot create a shadow database, set
   `shadowDatabaseUrl` to a second database instead.
4. Deploy. The build applies migrations and regenerates the client.
5. Smoke-test: storefront, admin login, order creation, receipt upload/download,
   delivery download, cron.

Migrations are forward-only. For destructive changes, take a backup and plan a
maintenance window.
