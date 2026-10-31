# Telegram integration

The code is implemented, but **Telegram is not configured in this workspace**. All Telegram environment variables are empty, and the admin UI displays the integration as “not configured”. No bot messages have been sent or verified against the real Telegram API.

This document explains how to configure and test it safely.

---

## 1. What the integration does

| Capability | Route / code |
| --- | --- |
| New-order notification to the admin chat with **Confirm** / **Cancel** buttons | `notifyAdminsNewOrder`, webhook callbacks |
| Customer status notifications for linked customers | `notifyCustomerStatus` |
| Customer Telegram linking (Mini App + reference + phone) | `POST /api/telegram/link` |
| Administrator sign-in from a Telegram Mini App | `POST /api/telegram/admin-login` |
| `/start` and `/help` menu with Mini App buttons | `POST /api/telegram/webhook` |
| Idempotent webhook processing | `TelegramUpdate` |
| Outbox with retries | `TelegramNotification`, `/api/cron/maintenance` |

Security properties:

- Every Mini App request verifies `initData` server-side with the bot token (HMAC-SHA256) and checks `auth_date`.
- Admin actions from callbacks require an active `AdminUser` whose `telegramId` matches the sender, plus the relevant permissions.
- Confirming a `PAYMENT_REVIEW` order from Telegram requires both `orders.confirm` and `payments.review`.
- Webhook requests must carry the exact `X-Telegram-Bot-Api-Secret-Token`.
- Messages never include activation codes or receipt files.
- Linking requires the order reference **and** the checkout phone; failures return a generic 404.
- Denied/failed callbacks are written to the audit log.

---

## 2. Create the bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, choose a display name and a username ending in `bot`.
3. Copy the HTTP API token. Treat it as a secret; anyone with it controls the bot.
4. Optional: `/setdescription`, `/setabouttext`, `/setuserpic`.
5. Optional: `/setcommands`:

   ```text
   start - Open the 4AB NET menu
   help - Show help
   ```

Do not commit the token. Put it only in `.env` on the server.

---

## 3. Environment variables

```dotenv
TELEGRAM_BOT_TOKEN="123456789:AA..."
TELEGRAM_WEBHOOK_SECRET="<random secret>"
TELEGRAM_ADMIN_CHAT_ID="-1001234567890"
TELEGRAM_BOT_USERNAME="YourBotUsername"
NEXT_PUBLIC_SITE_URL="https://example.com"
```

- `TELEGRAM_BOT_TOKEN` — from BotFather.
- `TELEGRAM_WEBHOOK_SECRET` — random string, allowed characters `A-Z a-z 0-9 _ -`. Telegram echoes it in the webhook header.
- `TELEGRAM_ADMIN_CHAT_ID` — chat that receives new-order notifications. Can be a private admin chat or a group. For groups, add the bot and use the negative chat ID.
- `TELEGRAM_BOT_USERNAME` — without `@`. Used for the customer link button and status display.
- `NEXT_PUBLIC_SITE_URL` — public HTTPS origin, no trailing slash. Required for Mini App URLs.

Generate the webhook secret:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9_-]/g,''))"
```

Restart the app after changing environment variables.

### Finding the admin chat ID

1. Add the bot to the target chat (or start a private chat with it).
2. Send a message in that chat.
3. Call:

   ```bash
   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
   ```

4. Read `result[].message.chat.id`. Group/supergroup IDs are negative.

If `getUpdates` is empty, remove any existing webhook first (see below), send a new message, and retry.

---

## 4. Register the webhook

Telegram requires a public HTTPS endpoint with a valid certificate. Localhost will not work.

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://example.com/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

Check it:

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Expected: the URL, no `last_error_message`, and pending updates draining.

Remove it (for example, before using `getUpdates` locally):

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

Notes:

- If the webhook secret is wrong, the route returns 401 and Telegram retries. Fix the secret and re-register.
- Updates are deduplicated by `update_id`. A duplicate returns `{ "duplicate": true }` with HTTP 200.
- The route returns 503 when Telegram is not configured, so it cannot silently accept traffic.
- Processing errors after the update is recorded are logged and acknowledged to avoid replaying partial actions.

---

## 5. Link administrators

Telegram admin actions and Mini App sign-in require a matching `AdminUser.telegramId`.

1. Have the administrator open a private chat with the bot and press **Start** (or send `/start`).
2. Find their numeric Telegram user ID (for example via `getUpdates`, or a trusted ID bot).
3. In **Admin → Administrators**, edit the administrator and enter the Telegram ID.
4. Save. The ID must be unique across administrators.

The administrator must also have the permissions required for the action:

| Action | Permission |
| --- | --- |
| Confirm an order (not in payment review) | `orders.confirm` |
| Confirm payment in `PAYMENT_REVIEW` | `orders.confirm` + `payments.review` |
| Cancel an order | `orders.confirm` (via callback) |

The owner bypasses permission checks but still needs a linked Telegram ID.

> The `/start` menu shows the “Open admin” button only for active administrators with a linked Telegram ID.

---

## 6. Mini App setup

### Admin sign-in

1. In BotFather: `/newapp` (or `/setmenubutton`).
2. Set the Web App URL to:

   ```text
   https://example.com/ar/admin/telegram-login
   ```

   Use `/en/...` or `/tr/...` for another default language. The page can switch languages afterwards.
3. Open the Mini App from the bot. The page verifies `initData` on the server, matches the Telegram ID to an active admin, creates a normal admin session, and redirects to the dashboard.

The endpoint is rate-limited per IP and per Telegram user. Knowing the bot or being in the admin chat is never sufficient.

### Customer linking

The order page and tracking page include a Telegram card. It only works inside a Telegram Mini App (`window.Telegram.WebApp.initData` exists).

Flow:

1. The customer opens the store/tracking Mini App from the bot.
2. Enters the order reference and checkout phone.
3. The server verifies `initData`, checks the reference + phone, and links the customer record.
4. Future status changes are sent to that Telegram chat.

A Telegram account can be linked to only one customer record. A customer record can be linked to only one Telegram account.

---

## 7. Notifications

### Admin new-order message

Sent to `TELEGRAM_ADMIN_CHAT_ID` when an order is created. It contains the reference, customer name/phone, total, payment method/status, line items, and buttons:

- **Confirm** → `ord:confirm:<orderId>`
- **Cancel** → `ord:cancel:<orderId>`
- **View** → admin order URL

No activation code, receipt file, or private delivery asset is included.

### Customer status message

Sent when an order status changes and the customer has a linked Telegram account. Messages are localized to the order locale and include a tracking Mini App button.

### Outbox and retries

Sends are persisted as `TelegramNotification` rows with status, attempts, and last error.

- The maintenance cron retries pending/failed notifications (up to 8 attempts).
- The admin settings page has a **Retry notifications** button for users with `telegram.manage`.
- Failed sends do not roll back orders or payments.

If `TELEGRAM_ADMIN_CHAT_ID` is missing, admin notifications are skipped. If the bot is not configured, no sends are attempted.

---

## 8. Local testing without a public URL

Telegram webhooks require public HTTPS, but you can test the bot locally by long-polling `getUpdates` and forwarding each update to the local webhook route.

### One-time discovery

1. Put `TELEGRAM_BOT_TOKEN` in `.env`.
2. Start the app (`npm run dev` or `npm start`).
3. In another terminal:

   ```bash
   npm run telegram:discover
   ```

4. Send `/start` to your bot from the chat that should receive order notifications.
5. The script removes any webhook, prints the chat ID and your Telegram user ID, and writes `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_BOT_USERNAME`, and a generated `TELEGRAM_WEBHOOK_SECRET` to `.env`.
6. Restart the app so it reads the new values.
7. Put the printed Telegram user ID into **Admin → Administrators → Telegram ID** for your admin account.

### Run the bridge

Keep the app running, then in a second terminal:

```bash
npm run telegram:bridge
```

The bridge:

- removes the webhook (polling and webhooks cannot run at the same time);
- long-polls `getUpdates`;
- posts each update to `http://127.0.0.1:3000/api/telegram/webhook` with the secret header;
- prints the HTTP result for every update.

Now `/start`, new-order notifications, and the **Confirm/Cancel** callback buttons work locally. `npm run telegram:info` shows the bot, webhook, and saved IDs at any time.

### Local limitations

- **Mini App pages need HTTPS.** Telegram does not open `http://localhost` as a Mini App. The bot falls back to normal URL buttons locally, so messages still send, but customer linking and Mini App admin login require a tunnel (Cloudflare Tunnel/ngrok) or a deployed HTTPS origin.
- `NEXT_PUBLIC_SITE_URL` is embedded at build time. If you change it, rebuild.
- The bridge is for development only. Do not use it in production; use a real webhook.
- Stop the bridge with `Ctrl+C` before registering a real webhook.

---

## 9. Testing without a real bot

You can test the failure paths without credentials:

```bash
# Not configured → 503
curl -i -X POST https://example.com/api/telegram/webhook \
  -H "content-type: application/json" \
  -d '{"update_id":1}'

# Configured but wrong secret → 401
curl -i -X POST https://example.com/api/telegram/webhook \
  -H "x-telegram-bot-api-secret-token: wrong" \
  -H "content-type: application/json" \
  -d '{"update_id":1}'
```

With a real bot on staging:

1. Create a test order.
2. Confirm the admin chat receives the message and buttons.
3. Press **Confirm** and verify the order status/history and audit entry.
4. Press **Cancel** on another order and verify inventory is released.
5. Link a test customer and change the order status; verify the customer message.
6. Send the same webhook update twice; verify the duplicate is acknowledged and not applied twice.
7. Remove the admin's `telegramId` and press a button; verify the denial is audited.
8. Sign in through the Mini App with an unlinked Telegram account; verify 403.

### Current verification status

Not performed in this workspace:

- Real bot creation and webhook registration.
- Real message delivery.
- Mini App `initData` from Telegram clients.
- Real callback button presses.

What was verified locally:

- The webhook returns 503 when unconfigured and 401 with a wrong secret when a temporary secret was set.
- A valid-secret request with a synthetic update is accepted, and a duplicate update is acknowledged.
- Invalid `initData` is rejected with 401 by the link/admin-login endpoints.
- Callback parsing and `initData` verification have unit tests.

See [`TESTING.md`](TESTING.md).

---

## 10. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Admin settings shows “missing” | Environment variable empty or app not restarted |
| Webhook 401 | `TELEGRAM_WEBHOOK_SECRET` does not match the registered `secret_token` |
| Webhook 503 | `TELEGRAM_BOT_TOKEN` or webhook secret empty |
| No admin messages | Bot not in the chat, wrong `TELEGRAM_ADMIN_CHAT_ID`, or bot blocked |
| Buttons say “not authorized” | Sender's Telegram ID is not linked to an active admin, or permissions are missing |
| Mini App login 403 | Telegram ID not set on the admin account, or account suspended |
| `initData` invalid | Wrong bot token, expired `auth_date`, or request not from Telegram |
| Customer link 404 | Wrong reference or phone (intentionally generic) |
| Duplicate notifications | Multiple app instances or cron runs; sends are at-least-once, not exactly-once |

Telegram delivery is best-effort. The order workflow never depends on a Telegram message succeeding.
