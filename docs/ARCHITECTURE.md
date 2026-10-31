# Architecture

This document describes how 4AB NET is put together and why. It is written for maintainers, not end users.

---

## 1. Runtime and routing

- **Next.js App Router** with React Server Components.
- All customer-facing pages live under `src/app/[locale]/...`.
- `src/middleware.ts`:
  - detects a locale from the path, then the `4ab_locale` cookie, then `Accept-Language`;
  - redirects locale-less URLs to `/[locale]/...`;
  - sets `x-locale` on the request for server components;
  - blocks unauthenticated access to admin pages except `login`, `setup`, `invite`, and `telegram-login`;
  - passes through static assets, API routes, the service worker, and the manifest.
- `src/app/[locale]/layout.tsx` validates the locale and renders `<html lang dir>`.
- API routes are locale-independent under `src/app/api/...`.
- The root `/offline` page is outside the locale tree so the service worker can precache a single URL.

### Locale handling

- Supported locales: `ar`, `en`, `tr` (`SUPPORTED_LOCALES` in `src/lib/constants.ts`).
- Arabic is the default and renders RTL.
- Dictionaries live in `src/lib/i18n/dictionaries/{ar,en,tr}.ts`. Arabic is the reference shape; TypeScript requires the other two to match.
- Database content uses translation tables (`ProductTranslation`, `CategoryTranslation`, `BannerTranslation`) and localized JSON settings.
- Fallback order: requested locale → Arabic → any available translation → slug/placeholder. Missing translations are visible in admin forms.

---

## 2. Data model

`prisma/schema.prisma` contains 26 models. The important groups:

### Identity and authorization

| Model | Purpose |
| --- | --- |
| `AdminUser` | Administrator, scrypt password hash, role (`OWNER`/`ADMIN`), status, Telegram ID |
| `AdminPermission` | One row per granted permission; unique per admin |
| `AdminSession` | SHA-256 hash of the opaque session token, expiry, IP/user agent |
| `AdminInvitation` | One-time invitation token (hashed), expiry, inviter |
| `AdminLoginToken` | One-time login token helper (hashed, expiry); the current Mini App route creates a session directly, so this model is not used by that flow |
| `AuditLog` | Actor, action, entity, JSON metadata, IP, timestamp |

### Catalog

`Category`, `CategoryTranslation`, `Product`, `ProductTranslation`, `ProductRelation`, `Banner`, `BannerTranslation`.

Products store price in integer minor units, stock-independent metadata (`dataAllowance`, `validityDays`, `network`, `countries`), flags (`isActive`, `isArchived`, `isFeatured`), and sort order. Stock is derived from `InventoryUnit`, not a mutable counter.

### Customers and orders

`Customer`, `Order`, `OrderItem`, `Payment`, `PaymentReceipt`, `OrderStatusHistory`.

- `Order` stores a public `reference`, a **hashed** tracking token, customer snapshots, totals, statuses, payment method, locale, optional idempotency key, reservation expiry, and internal `adminNote`.
- `OrderItem` snapshots product name (in the order locale), slug, allowance, validity, unit price, quantity, and line total.
- `Payment` is one-to-one with an order and tracks verification state and reviewer.
- `PaymentReceipt` stores a private storage path, original name, MIME type, size, and SHA-256.
- `OrderStatusHistory` records every transition with actor type (`SYSTEM`, `ADMIN`, `TELEGRAM`).

### Discount coupons

`Coupon` stores the normalized unique `code`, `type` (`PERCENT`/`FIXED`), the value (`percentBasisPoints` where 100 = 1%, or `amountMinor`), `minSubtotalMinor`, an optional `maxDiscountMinor` cap for percentage coupons, optional `usageLimit` (total redemptions), optional `perCustomerLimit` (counted by customer phone), `usedCount`, optional `startsAt`/`expiresAt`, `isActive`, and the creating admin.

- `Order.couponId` links the redemption; `Order.couponCode` snapshots the code so later edits to the coupon never rewrite history.
- `usedCount` is incremented with a conditional `updateMany` (`usedCount < usageLimit`) inside the order transaction, so concurrent checkouts cannot exceed the limit.
- Cancelling an order, or the maintenance job cancelling an expired reservation, decrements `usedCount` (never below zero).
- Rule evaluation lives in `src/lib/coupon-rules.ts` (pure, unit-tested); database lookup and per-customer counting live in `src/lib/coupons.ts`.
- Discounts are floored to the kuruş, capped by `maxDiscountMinor`, and can never exceed the subtotal. A fully discounted order becomes `AWAITING_CONFIRMATION` with a `VERIFIED` payment record instead of asking for a bank transfer.

### Inventory

`InventoryUnit` is the unit of stock and delivery:

```text
AVAILABLE ──reserve──▶ RESERVED ──assign──▶ ASSIGNED ──deliver──▶ ASSIGNED (deliveredAt set)
     ▲                    │
     └──── release ───────┘
Any non-assigned unit can be revoked.
```

Each unit belongs to one product and may be linked to an order and order item. Activation code, QR path, and instructions are private.

### Settings and integrations

`StoreSetting` stores JSON values keyed by `SETTING_KEYS`. `TelegramChat` links a customer to a Telegram user. `TelegramUpdate` provides webhook idempotency. `TelegramNotification` is an outbox with attempt counts and status. `InvoiceSequence` exists in the schema but is not used by the current flows.

### Indexes

Indexes cover the query paths that matter: order status/payment status/date/customer, inventory `(productId, status)` and `(status, reservedUntil)`, receipt/order lookups, audit date, and unique constraints for references, phone numbers, Telegram IDs, and idempotency keys.

---

## 3. Money

- All monetary columns are `Int` in **minor units** (kuruş).
- `src/lib/money.ts` converts, formats, and multiplies with integer arithmetic.
- The currency is fixed to `TRY`; the settings page shows it as locked.
- Formatting uses `Intl.NumberFormat` per locale; the currency symbol is `₺`.
- The client never supplies prices. `createOrder` reads product prices inside the transaction, computes line totals and subtotal, and writes the result.

---

## 4. Order lifecycle

### Creation

`POST /api/orders` → `createOrder()` in `src/lib/orders.ts`:

1. Checks maintenance mode and whether orders/payment methods are enabled.
2. Validates name, phone, item count, and quantities.
3. Merges duplicate product lines.
4. Opens a Prisma transaction:
   - loads products and translations;
   - rejects inactive/archived products and invalid prices;
   - counts `AVAILABLE` inventory per product;
   - computes totals from database prices;
   - upserts the customer by normalized phone;
   - validates the optional coupon against the server-computed subtotal and the customer's phone, computes the discount, and claims a usage slot;
   - creates the order and items;
   - reserves inventory units (`AVAILABLE` → `RESERVED`) until `now + 48h`;
   - creates the payment row and initial status history;
   - creates a Telegram notification outbox row.
5. Returns the reference and a signed access token.

Idempotency: if the client supplies an `idempotencyKey` that already exists, the existing order is returned instead of creating a duplicate. The API also rate-limits order creation per IP.

### Status transitions

Allowed transitions are defined in `ORDER_TRANSITIONS` (`src/lib/constants.ts`) and enforced server-side in `src/lib/orders.ts`:

```text
AWAITING_CONFIRMATION → CONFIRMED | CANCELLED
AWAITING_PAYMENT      → PAYMENT_REVIEW | CANCELLED
PAYMENT_REVIEW        → CONFIRMED | AWAITING_PAYMENT | CANCELLED
CONFIRMED             → PROCESSING | DELIVERED | CANCELLED
PROCESSING            → DELIVERED | CANCELLED
DELIVERED             → REFUNDED
CANCELLED / REFUNDED  → (terminal)
```

`DELIVERED` is only reachable through the delivery workflow, which requires assigned inventory and the `inventory.deliver` permission. Cancelling an order releases reserved units and the coupon usage slot. Refunding marks the payment refunded.

### Expiry

`/api/cron/maintenance` (and the admin order UI where relevant) releases reservations older than `reservedUntil`, returning units to `AVAILABLE`, moving unpaid orders to `CANCELLED` with history, and releasing any coupon usage slot. The job is idempotent and protected by `CRON_SECRET`.

---

## 5. Payments and receipts

- Bank transfer is manual. Checkout shows bank details from settings and creates an `AWAITING_PAYMENT` order.
- The customer uploads a receipt through `POST /api/orders/[reference]/receipt`, authorized by the order access cookie.
- Uploads are validated by magic bytes (JPEG/PNG/WebP/PDF), size, and extension; files are stored under `storage/private/receipts/` with random names.
- The order moves to `PAYMENT_REVIEW` and the payment to `AWAITING_VERIFICATION`.
- An admin with `payments.review` confirms or rejects. Confirmation also requires `orders.confirm`; the UI and action check both.
- Receipts are streamed by `GET /api/admin/receipts/[id]` only for admins with `payments.receipts.view` (or the owner).
- Cash on delivery is available only when enabled in settings.

---

## 6. Order access and tracking

Two mechanisms:

1. **Access cookie** — `4ab_order_access`, HttpOnly, signed with HMAC-SHA256 using `APP_SECRET`, scoped to the order reference and expiring after 30 days. Issued when an order is created and when tracking succeeds.
2. **Tracking form** — `POST /api/orders/access` with reference + phone. Responses are deliberately identical for unknown references and wrong phones (generic 404) to prevent enumeration. The endpoint is rate-limited.

Delivery details (activation code, QR, instructions) are only rendered when the viewer is authorized: the customer with a valid access cookie, or an admin with `inventory.deliver`.

---

## 7. Admin authentication

- Passwords: scrypt with a random salt, constant-time comparison.
- Sessions: 32 random bytes; the database stores only the SHA-256 hash. Cookie is HttpOnly, `SameSite=Lax`, `Secure` in production, 8-hour lifetime.
- Session lookup checks expiry, revocation, and account status on every request.
- Login and setup are rate-limited (in-process).
- Setup is available only when no owner exists.
- Invitations and Mini App login tokens are single-use, hashed, and time-limited.
- Logout deletes the session row and clears the cookie.

### Permissions

`PERMISSIONS` in `src/lib/constants.ts`:

```text
dashboard.view, orders.view, orders.update, orders.confirm, payments.review,
payments.receipts.view, products.manage, categories.manage, banners.manage,
coupons.manage, inventory.manage, inventory.deliver, customers.view,
content.manage, translations.manage, reports.view, settings.manage,
telegram.manage, audit.view, admins.manage
```

Enforcement points:

- Server actions call `guard`/`guardAny`, which re-read the session and permissions from the database.
- Route handlers check permissions before streaming private files or performing delivery.
- Admin pages re-check permissions; navigation only hides links as a convenience.
- Owner bypasses checks but remains subject to server-side validation.
- `translations.manage` grants access to localized content fields in settings (alongside `content.manage`); `content.manage` covers non-sensitive localized content; `settings.manage` is required for bank/store/operational settings. Catalog translation fields remain under `products.manage`, `categories.manage`, and `banners.manage`.
- `coupons.manage` covers creating, editing, enabling/disabling, and deleting coupons; every mutation is audited.
- Admin management (`admins.manage`) is owner-only in the UI and action layer.

### Audit

Privileged mutations call `auditAdmin()` with action, entity, JSON metadata, and IP. The audit page requires `audit.view`. Sensitive values (passwords, activation codes, receipt contents) are not written to audit metadata.

---

## 8. Storage

`src/lib/storage.ts` owns validation and both backends. It selects the backend
from the environment at call time:

| Kind | Local development | Hosted (Supabase) | Access |
| --- | --- | --- | --- |
| Catalog images | `public/uploads/` | `media` bucket, `catalog/<uuid>.<ext>` | Public, immutable random names |
| Receipts | `storage/private/receipts/` | `private` bucket, `receipts/<uuid>.<ext>` | Authorized route only |
| Delivery QR/images | `storage/private/delivery/` | `private` bucket, `delivery/<uuid>.<ext>` | Authorized route only |

Private paths are stored in the database as `receipts/<uuid>.<ext>` /
`delivery/<uuid>.<ext>`, identical on both backends, so rows survive a move.

Local disk is used when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both
empty. Setting only one of them fails uploads with `storage-misconfigured`.
On a serverless platform without Supabase configured, writes fail with
`storage-not-configured` rather than silently using an ephemeral disk.

The Supabase adapter talks to the Storage REST API with the service-role key
(server-only, bypasses RLS). Private objects are read by the server and streamed
through the existing authorized routes; no signed URLs or public links are
issued. `.gitignore` excludes uploaded files while keeping `.gitkeep` placeholders.

---

## 9. Telegram

- `src/lib/telegram.ts` verifies Mini App `initData` using the bot token and HMAC-SHA256, checks `auth_date`, parses callback data strictly, and sends messages.
- `/api/telegram/link` links a customer chat after verifying `initData` and an order access token.
- `/api/telegram/webhook` verifies the secret header, deduplicates update IDs, handles confirm/cancel callbacks with permission checks, and audits actions.
- `/api/telegram/admin-login` issues a one-time admin login token for a linked Telegram admin.
- Notifications are written to an outbox and retried by the maintenance cron or the admin retry button. They never include activation codes or receipt files.

See [`TELEGRAM.md`](TELEGRAM.md).

---

## 10. PWA

- `src/app/manifest.ts` generates `/manifest.webmanifest`.
- `public/sw.js` caches only static assets and navigations; it explicitly refuses `/api/`, `/admin/`, `/orders/`, `/checkout`, `/cart`, and non-GET requests.
- Offline navigation falls back to `/offline`.
- The service worker is registered by a client component and updates conservatively.

---

## 11. Error handling and validation

- Zod schemas in `src/lib/validation.ts` validate API input and shared formats.
- `OrderError` carries an HTTP status and a stable code; the API maps codes to localized messages without leaking internals.
- Server actions return localized flash keys instead of throwing raw errors.
- Generic responses are used for tracking and access failures to avoid leaking whether a reference or phone exists.
- `notFound()` is used for invalid locales and missing public resources.
- Coupon failures use stable codes (`COUPON_NOT_FOUND`, `COUPON_INACTIVE`, `COUPON_NOT_STARTED`, `COUPON_EXPIRED`, `COUPON_EXHAUSTED`, `COUPON_MIN_SUBTOTAL`, `COUPON_CUSTOMER_LIMIT`, `COUPON_INVALID`). `POST /api/coupons/validate` only previews a discount against the server-priced cart; `createOrder` re-validates and claims usage inside its transaction, so a stale preview can never grant an invalid discount.

---

## 12. Key trade-offs

| Decision | Reason | Consequence |
| --- | --- | --- |
| SQLite locally | No PostgreSQL/Docker available | Production uses the generated PostgreSQL schema + Supabase |
| Cart in `localStorage` | Simple, fast, no server cart table | Cart is per-browser; server always re-prices |
| Manual bank transfer | No payment gateway credentials or requirement for online card processing | Admin must review receipts |
| Custom auth | Avoids external identity dependency | MFA and password reset are not implemented |
| Dual storage backend | Local disk is simplest for development; serverless needs object storage | Two code paths; Supabase path untested against a real bucket |
| In-process rate limiting | No Redis available | Limits are per-process, not cluster-wide |
| No CSP yet | Inline styles/scripts and Next.js constraints | Documented hardening item, not a silent gap |
