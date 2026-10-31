# Security

This document describes the security model, the controls that are implemented, and the gaps that remain. It is not a claim that the application has been independently audited or penetration-tested.

---

## 1. Assets

- Administrator credentials, sessions, invitations, and permission assignments.
- Customer names and phone numbers.
- Payment receipts (may contain bank details).
- eSIM activation codes, QR codes, and delivery instructions.
- Order history, internal admin notes, and audit logs.
- Integration secrets: `APP_SECRET`, Telegram token/webhook secret, `CRON_SECRET`, database credentials.

---

## 2. Trust boundaries

| Boundary | Notes |
| --- | --- |
| Browser ↔ Next.js | All input is untrusted. Prices, permissions, statuses, and IDs submitted by the browser are re-derived or re-checked server-side. |
| Next.js ↔ database | Prisma parameterizes queries. |
| Next.js ↔ filesystem | Only validated uploads are written; private files are outside the web root. |
| Next.js ↔ Telegram | `initData` and webhook secrets are verified; callback identity is mapped to an active admin. |
| Reverse proxy ↔ app | The app trusts forwarded headers for IP display/rate limiting. Configure the proxy to overwrite, not append untrusted client values. |

---

## 3. Authentication

- Passwords are hashed with **scrypt** (random 16-byte salt, 64-byte derived key) and compared with `timingSafeEqual`.
- Minimum password length is **12 characters**; maximum 200.
- Session tokens are 32 random bytes. Only a SHA-256 hash is stored in `AdminSession`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`, with an 8-hour lifetime.
- Sessions are checked against the database on every privileged request. Expired, revoked, or suspended-admin sessions are rejected.
- Logout deletes the session row.
- Login is rate-limited to **8 attempts / 15 minutes per IP + email**.
- Owner setup is rate-limited to **5 attempts / hour per IP** and refuses to run if an owner already exists.
- Invitations and Mini App login tokens are random, hashed at rest, single-use, and time-limited.
- Telegram Mini App sign-in verifies `initData` with the bot token and requires a matching active administrator. Membership in the admin chat is not sufficient.

### Not implemented

- Password reset / “forgot password”.
- Password change from the admin UI (an invited admin chooses a password at acceptance; the owner chooses one at setup).
- MFA/TOTP.
- Email verification.
- Account lockout beyond the in-process rate limit.

These are documented gaps, not silently implied features.

### Dependency advisories

`npm audit` was reviewed during development. The production build passes with a patched PostCSS override. Remaining advisories at the time of writing:

- **Prisma CLI → `deepmerge-ts`** (high, development-time config merging). The fix requires Prisma 7, a breaking major upgrade. The runtime client does not use this code path.
- **Vitest → `tinypool` / `@vitest/mocker`** (test-runner only). Fixing them requires a major Vitest upgrade; they are not shipped in the production bundle.

Do not run untrusted test code or untrusted Prisma config. Re-check `npm audit` before each deployment and upgrade when compatible releases are available. See [`LIMITATIONS.md`](LIMITATIONS.md).

---

## 4. Authorization

- Permissions are stored in `AdminPermission` and loaded from the database for each request.
- `guard` / `guardAny` in server actions re-authenticate and re-check permissions.
- Route handlers check permissions before streaming private files or performing delivery.
- Admin pages re-check permissions before rendering data.
- Middleware only performs a coarse “session cookie exists” redirect; it is **not** the authorization boundary.
- The owner bypasses permission checks but not validation or workflow rules.
- Owner accounts cannot be suspended, deleted, or have permissions changed by other admins.
- Administrators cannot grant themselves permissions: admin management is owner-only.
- Permission changes are audited.
- `translations.manage` and `content.manage` grant access to localized content fields only; bank, store, and operational settings require `settings.manage`.
- Sensitive delivery data requires `inventory.deliver`.

### Object-level checks

- Orders are addressed by an unguessable reference plus a signed access cookie, or reference + phone tracking.
- Receipts are addressed by internal IDs but require `payments.receipts.view`.
- Delivery assets require `inventory.deliver` and an authorized order.
- Customer linking requires the order reference, the checkout phone, and verified Telegram `initData`.
- Tracking and linking return generic failures to reduce enumeration.

---

## 5. CSRF and browser security

- Mutations use Next.js server actions or same-origin `fetch` with `credentials: "same-origin"`.
- Session cookies are `SameSite=Lax` and `HttpOnly`.
- Next.js server actions enforce same-origin requests by default.
- API mutations require JSON bodies and same-origin credentials; no CORS headers are opened.
- The order access cookie is `HttpOnly`, signed, and scoped to the order reference.
- Logout is a server action, not a GET link.

### Response headers

Configured in `next.config.ts`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security` in production (`max-age=63072000; includeSubDomains; preload`)
- `Cache-Control: no-store` for `/api/*`

**No Content-Security-Policy is set.** Adding one requires auditing inline styles/scripts and Next.js runtime requirements. This is a known hardening item; see [`LIMITATIONS.md`](LIMITATIONS.md).

---

## 6. Input validation and injection

- Zod schemas validate API payloads and shared formats (email, password, phone).
- Server actions validate lengths, enums, IDs, and numeric ranges.
- Prisma uses parameterized queries; no raw SQL is used in application code.
- React escapes rendered content by default. Telegram messages use `escapeHtml` for dynamic values and `parse_mode: HTML`.
- Uploads are validated by magic bytes, not only the declared MIME type or extension:
  - images: JPEG, PNG, WebP;
  - receipts: JPEG, PNG, WebP, PDF.
- File names are randomized; the original name is stored only as metadata.
- Paths are constructed server-side from validated relative paths; uploads cannot choose arbitrary destinations.
- Size limits: 5 MB per upload (`MAX_*_BYTES` / `MAX_UPLOAD_MB`), 8 MB server-action body limit.
- HTML in settings is rendered as text, not raw HTML.

### Upload-specific controls

- Private files are written under `storage/private/`, outside `public/`.
- Public catalog images are written under `public/uploads/`.
- Receipt downloads require an authenticated admin with the right permission.
- Receipt upload requires the signed order access cookie.
- Receipt uploads are rate-limited to 6 / 10 minutes per IP.

---

## 7. Rate limiting

Implemented in-process (`src/lib/rate-limit.ts`):

| Endpoint | Limit |
| --- | --- |
| Admin login | 8 / 15 min per IP + email |
| Owner setup | 5 / hour per IP |
| Order creation | 8 / minute per IP |
| Order tracking | 10 / 10 min per IP |
| Receipt upload | 6 / 10 min per IP |
| Telegram link | 10 / 10 min per IP; 6 / 10 min per Telegram user |
| Telegram admin login | 10 / 10 min per IP; 6 / 10 min per Telegram user |

Limits are per Node.js process. Behind multiple instances, effective limits multiply. Use a shared store (Redis) or a gateway for production scale.

---

## 8. Data protection and privacy

- Public pages expose only catalog data.
- Customer phone numbers are shown in full only to admins with `customers.view`/`orders.view`; masked values are used where appropriate.
- Internal `adminNote` is never rendered to customers.
- Order access tokens and tracking tokens are stored hashed.
- Audit logs store actor, action, entity, non-sensitive metadata, and IP; they do not store passwords, session secrets, activation codes, or receipt contents.
- Telegram notifications exclude activation codes and receipt files.
- The privacy/terms/refund/retention pages are database-driven and editable; the seeded text is demo content and must be replaced with a real policy.

### Retention

- The maintenance cron prunes expired sessions, login tokens, old Telegram updates, and sent notifications.
- **Orders, customers, receipts, and audit logs are not automatically deleted.** The retention policy text is informational. Implement a documented deletion/anonymization process appropriate to your jurisdiction before production.
- Backups inherit the retention of the backup system.

### Encryption

- TLS is expected at the reverse proxy.
- Database encryption at rest is not implemented by the app; use volume/database encryption.
- Backups must be encrypted separately.
- Secrets live in `.env`; restrict file permissions and avoid committing them.

---

## 9. Audit logging

Audited actions include:

- admin login/logout, failed Telegram login;
- invitation creation/revocation;
- permission changes, suspension/activation;
- product/category/banner creation, update, archive, delete;
- inventory creation, revocation, release;
- order status changes, payment verification, notes;
- delivery;
- settings changes;
- Telegram callback success/denial/failure;
- customer Telegram linking.

Audit access requires `audit.view`. Entries are append-only from the application's perspective; there is no UI to edit or delete them.

---

## 10. Telegram security

See [`TELEGRAM.md`](TELEGRAM.md). Key points:

- `initData` is verified with the bot token and `auth_date`.
- Webhook requests require the exact secret header.
- Update IDs are deduplicated.
- Callback actions require an active, linked admin with the correct permissions.
- Telegram message content is HTML-escaped.
- No secrets are sent to customers.

---

## 11. Logging and error handling

- API errors return stable codes without stack traces or database details.
- Tracking/linking use generic 404 responses.
- Server logs may include error objects and order IDs; avoid logging secrets or full request bodies.
- `console.error` is used for unexpected failures; production should ship logs to a protected sink with retention.

---

## 12. Deployment hardening checklist

Verified against the live deployment on 2026-10-30 (`https://4abnet.netlify.app`):

- [x] HTTPS everywhere; HSTS enabled after confirming HTTPS.
- [x] Strong, unique `APP_SECRET`, `CRON_SECRET`, and database password.
- [x] `.env` readable only by the service user.
- [x] `storage/` and `data/` not served by the proxy.
- [x] Cron secret configured; endpoint not public without it (verified **401**).
- [x] Telegram webhook rejects unsigned calls (verified **401** without the secret header).
- [x] Session cookies `HttpOnly` + `Secure` + `SameSite=Lax`; admin sessions expire after 8 h.
- [x] Rate limits on order creation, coupon preview, tracking, receipt upload, admin login, setup, and Telegram Mini App login.
- [x] Upload type is decided by magic bytes, not the client MIME type; size capped by `MAX_UPLOAD_MB`.
- [x] No server secret appears in the client bundle (checked `APP_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
- [x] `.env`, `storage/`, and `data/` are absent from the deployed server function bundle.
- [x] Security headers present: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removed.
- [x] Daily scheduled maintenance function registered (`maintenance`, `@daily`).

Still open:

- [ ] CSP added and tested.
- [ ] Database and file backups encrypted, off-site, and restore-tested.
- [ ] Demo bank details, products, inventory, and policies replaced.
- [ ] Admin accounts reviewed; owner Telegram ID set only if needed.
- [ ] Audit log access limited to `audit.view`.
- [ ] Dependency updates and `npm audit` reviewed regularly.
- [ ] Logs monitored for 5xx, auth failures, and repeated 429s.
- [ ] MFA/password reset implemented if required by policy.
- [ ] Reverse proxy overwrites `X-Forwarded-For` — not applicable on Netlify, which terminates the request itself.

---

## 13. Incident response

1. Revoke affected admin sessions (suspend the account or delete `AdminSession` rows).
2. Rotate `APP_SECRET` (invalidates order-access cookies), Telegram token/webhook secret, `CRON_SECRET`, and database credentials.
3. Remove or replace the Telegram webhook if the bot is compromised.
4. Review `AuditLog` for the affected period.
5. Check receipts/delivery files for unauthorized access.
6. Restore from a known-good backup if data integrity is in doubt.
7. Notify affected customers and authorities as required by law.
8. Document the incident and the remediation.

---

## 14. Reporting

There is no bug bounty or formal security contact in this repository. Add a real security contact before launch.
