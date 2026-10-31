# Testing

This document records what is automated, what was manually smoke-tested, and what still needs verification.

---

## 1. Commands

```bash
npx tsc --noEmit     # type check
npm test             # Vitest unit tests
npm run build        # production build (runs prisma generate)
npx prisma migrate status
```

There is **no Playwright/E2E suite** in this repository. The `e2e` script and Playwright dependency were removed rather than leaving a command that cannot run. Browser flows must be tested manually or by adding a real E2E suite.

There is also no standalone ESLint configuration; `npm run build` performs TypeScript checking. Add ESLint (and fix findings) before treating linting as covered.

---

## 2. Unit tests

`tests/unit/` contains 9 files and **57 tests**:

| File | Coverage |
| --- | --- |
| `money.test.ts` | Minor-unit parsing/formatting, integer line totals, rounding safety |
| `phone.test.ts` | Turkish local formats, international normalization, invalid input |
| `order-status.test.ts` | Allowed/forbidden order transitions, terminal states |
| `order-token.test.ts` | Access-token round trip, tamper rejection, expiry |
| `validation.test.ts` | Order/tracking/setup schemas, quantity/note limits, invalid locales |
| `settings.test.ts` | Default merging, localized value selection, boolean/string helpers, fallback |
| `i18n.test.ts` | Dictionary parity and locale normalization/fallback |
| `telegram.test.ts` | `initData` signature verification, expiry, callback parsing, secret comparison |
| `coupons.test.ts` | Code normalization/format, percentage/fixed math, flooring, caps, subtotal limit, schedule window, usage/per-customer limits, state labels |

`tests/stubs/server-only.ts` stubs the `server-only` import so pure server modules can be tested under Vitest.

### Latest local result

```text
Test Files  9 passed (9)
Tests       57 passed (57)
```

Type checking and the production build also pass.

---

## 3. Runtime smoke tests performed

These were executed against a **temporary database** (`data/smoke.db`) with a temporary production server, then the database and uploaded files were deleted. The development database was not used for order tests.

| Area | Checks performed |
| --- | --- |
| Storefront locales | `/ar`, `/en`, `/tr` return 200 and render with the correct `lang`/`dir` |
| Catalog | Product list, category page, search page, product detail return 200 |
| Order creation | `POST /api/orders` returns 201; totals computed server-side; inventory reserved |
| Idempotency | Repeating the request with the same key returns the same reference, no duplicate |
| Tracking | Reference + phone issues an access cookie; wrong phone/reference returns generic 404 |
| Receipts | Upload returns 201, order moves to `PAYMENT_REVIEW`, file stored privately |
| Private files | Receipt is not reachable via a public URL; QR/receipt APIs return 404 without access |
| Cron | Returns 401 without the secret, 200 with it |
| Telegram webhook | 503 when unconfigured, 401 with a wrong secret, duplicate update acknowledged |
| Telegram link/login | Invalid `initData` rejected with 401 |
| Admin auth | Owner pages return 200 with a valid session; no session redirects to login |
| Permissions | Limited admin denied settings/administrators; activation code hidden without `inventory.deliver`; delivery API returns 403 |
| Suspension | Suspended admin session is rejected and redirected to login |
| Demo data | Seed creates no owner, no orders, and marks inventory `DEMO-ONLY-` |
| Concurrent inventory | 8 simultaneous orders for a product with 6 units: exactly 6 × 201, 2 × 409 `NO_STOCK`, 6 units `RESERVED`, no oversell |
| Coupons (server logic) | Percentage and fixed discounts, flooring and caps, minimum subtotal, schedule window, disabled/unknown codes, per-customer limit, usage release on cancellation and on reservation expiry, fully discounted orders |
| Coupons (concurrency) | Three simultaneous checkouts for a coupon with `usageLimit = 1`: exactly 1 × 201, 2 × `COUPON_EXHAUSTED`, `usedCount = 1` |
| Coupons (HTTP) | `POST /api/coupons/validate` returns 200 with `discountMinor`/`totalMinor` and 400 `COUPON_NOT_FOUND`; `POST /api/orders` applies the discount, snapshots the code, and rejects a repeat customer with `COUPON_CUSTOMER_LIMIT` |
| Coupons (admin) | Create/edit/toggle/delete through the real server actions: `?ok=created`, `?ok=updated`, `?ok=deleted`, `?error=couponValueInvalid`, `?error=couponCodeTaken`; audit rows `coupon.created/updated/disabled/deleted`; AR/EN/TR list, new, and edit pages render with the usage counter |
| Coupons (display) | Customer order page shows the code and discount line; checkout summary shows the discount; admin order detail shows the code next to the discount; admin Telegram notification includes the subtotal/discount lines |

The concurrency check ran on a disposable copy of the database with the production build on a separate port. It confirms that reservation is serialized correctly for this single-instance SQLite setup; it is not a load test.

Not covered by these smoke tests:

- Real browser interaction (clicks, client-side cart hydration, coupon apply/remove buttons, PWA install).
- Real Telegram clients or message delivery (the local `getUpdates` bridge was tested separately; public webhook/Mini App flows were not).
- Real bank transfer or payment gateway (none exists; review is manual).
- PostgreSQL.
- Sustained concurrent load or multi-instance behaviour.

---

## 4. Manual test checklist

Run this on staging after deployment. Use a test database or clean up afterwards.

### First-run and auth

- [ ] `/ar/admin/setup` creates the first owner with a 12+ character password.
- [ ] Setup is unavailable after an owner exists.
- [ ] Login succeeds with correct credentials and fails generically with wrong ones.
- [ ] Too many failed logins return a rate-limit message.
- [ ] Logout clears the session and protected pages redirect to login.
- [ ] Invite link creates an admin, is single-use, and expires.
- [ ] Owner can suspend/reactivate an admin; the suspended admin is logged out.
- [ ] Non-owner cannot access administrators or change permissions.
- [ ] Owner account cannot be suspended/deleted by another admin.

### Catalog and content

- [ ] Create/edit/archive/delete a product with AR/EN/TR fields and an image.
- [ ] Create/edit/delete a category; deleting a category with products is blocked.
- [ ] Create/edit/delete a banner; it appears on the homepage when active.
- [ ] Missing translations fall back and are visible in admin forms.
- [ ] Settings changes appear on the storefront after save.
- [ ] `translations.manage` can edit localized fields but not bank/store settings.
- [ ] `content.manage` cannot edit bank/store settings.
- [ ] Demo bank warning is visible until replaced.

### Coupons

- [ ] Create a percentage coupon with a minimum order and a maximum discount cap.
- [ ] Create a fixed-amount coupon and an unlimited coupon (empty usage limit).
- [ ] Entering a code in lowercase at checkout applies it and shows the normalized code.
- [ ] The discount line and payable total match the server response; the order total matches what was shown.
- [ ] A code below the minimum order shows the localized minimum amount.
- [ ] Expired, scheduled, disabled, and unknown codes show distinct messages.
- [ ] A second order by the same phone is rejected when the per-customer limit is reached.
- [ ] A coupon with `usageLimit = 1` can be redeemed once; the admin list shows `1 of 1` and the exhausted badge.
- [ ] Cancelling the order in admin frees the usage slot.
- [ ] A 100% coupon creates a `AWAITING_CONFIRMATION` order with no bank transfer due.
- [ ] Editing a coupon does not change the code or discount recorded on past orders.
- [ ] A coupon used by an order cannot be deleted; it can be disabled instead.
- [ ] Non-owner admins without `coupons.manage` cannot see or open the coupons page.

### Inventory and orders

- [ ] Add inventory units; stock count increases.
- [ ] Revoke an available unit; stock decreases.
- [ ] Place an order; stock is reserved and the reference is shown.
- [ ] Re-submit with the same idempotency key; no duplicate order.
- [ ] Place an order with insufficient stock; it fails cleanly.
- [ ] Upload a valid receipt; order moves to `PAYMENT_REVIEW`.
- [ ] Reject an invalid file type/size.
- [ ] Confirm payment with `payments.review` + `orders.confirm`; order becomes `CONFIRMED`.
- [ ] Assign inventory, deliver, and verify the customer sees activation data only with access.
- [ ] Cancel an order; reserved units return to `AVAILABLE`.
- [ ] Expire a reservation via the cron; stale order is cancelled and stock released.
- [ ] Admin note is not visible to the customer.
- [ ] Order history and audit log record the actions.

### Tracking and privacy

- [ ] Wrong reference/phone returns the same generic error as unknown.
- [ ] Access cookie works for the order and not for another reference.
- [ ] Receipt/QR routes deny access without the cookie.
- [ ] Private storage is not reachable at `/storage/...`.
- [ ] Telegram messages (if configured) contain no activation codes or receipts.

### Locales and PWA

- [ ] AR is RTL, EN/TR are LTR; language choice persists.
- [ ] Currency displays as `₺` with correct minor-unit formatting.
- [ ] Manifest and icons load; install prompt appears on HTTPS.
- [ ] Offline navigation shows `/offline`; cart/checkout/admin are not cached.
- [ ] Service worker does not cache API or order pages.

### Telegram (only with real credentials)

- [ ] Webhook registration succeeds and `getWebhookInfo` shows no errors.
- [ ] New order sends an admin message with working buttons.
- [ ] Confirm/cancel from Telegram updates the order and audit log.
- [ ] Unlinked admin receives “not authorized”.
- [ ] Linked customer receives status messages.
- [ ] Duplicate update is not applied twice.

---

## 5. Test data hygiene

- Do not run smoke tests against production.
- If testing on the development database, delete test orders/customers and revoke test inventory afterwards.
- The seed is idempotent for catalog/settings but creates demo inventory; do not seed production.
- Temporary databases and uploaded test receipts should be deleted after testing.
- Never commit `.env`, databases, receipts, or delivery files.

---

## 6. Adding tests

- Pure logic belongs in `src/lib` with unit tests in `tests/unit`.
- Database-backed integration tests should use a separate `DATABASE_URL` and a disposable database.
- Browser tests should be added with a real Playwright config and at least one critical path (order + receipt + admin confirmation) before claiming E2E coverage.
- Keep the i18n parity test passing when adding dictionary keys.
