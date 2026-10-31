import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { normalizeLocale, type Locale } from "@/lib/constants";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramInitData = {
  user: TelegramUser;
  authDate: number;
  queryId?: string;
};

/** Escape dynamic text for Telegram HTML parse mode. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Verify Telegram Mini App initData per the official algorithm:
 * secret_key = HMAC_SHA256("WebAppData", bot_token)
 * hash = hex(HMAC_SHA256(secret_key, data_check_string))
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramInitData | null {
  if (!initData || !botToken) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const entries: [string, string][] = [];
  params.forEach((value, key) => entries.push([key, value]));
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate)) return null;
  if (nowSeconds - authDate > maxAgeSeconds) return null;
  if (authDate - nowSeconds > 300) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (!user || typeof user.id !== "number") return null;
    return {
      user,
      authDate,
      queryId: params.get("query_id") || undefined,
    };
  } catch {
    return null;
  }
}

export function telegramLocale(user: Pick<TelegramUser, "language_code">): Locale {
  return normalizeLocale((user.language_code || "").slice(0, 2));
}

export type OrderCallback = { action: "confirm" | "cancel"; orderId: string };

/**
 * Parse a strict order callback payload. Unknown or malformed callback data is
 * rejected instead of being interpreted loosely.
 */
export function parseOrderCallback(data: string | undefined | null): OrderCallback | null {
  if (!data) return null;
  const match = /^ord:(confirm|cancel):([A-Za-z0-9_-]{5,64})$/.exec(data);
  if (!match) return null;
  return { action: match[1] as "confirm" | "cancel", orderId: match[2] };
}

/** Constant-time comparison for webhook secrets. */
export function secretMatches(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>> };

type SendOptions = {
  replyMarkup?: InlineKeyboard;
  disablePreview?: boolean;
  kind?: string;
};

type SendResult = { ok: boolean; error?: string };

async function callTelegram(token: string, method: string, payload: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  result?: unknown;
  description?: string;
  retryAfter?: number;
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: unknown;
      description?: string;
      parameters?: { retry_after?: number };
    };
    return {
      ok: response.ok && body.ok === true,
      status: response.status,
      result: body.result,
      description: body.description,
      retryAfter: body.parameters?.retry_after,
    };
  } catch (error) {
    return { ok: false, status: 0, description: error instanceof Error ? error.message : "network-error" };
  }
}

export function isTelegramConfigured(): boolean {
  return env.isTelegramConfigured;
}

/**
 * Send a Telegram message and persist the attempt. Failures never throw to
 * callers that protect order integrity; they are stored for retry.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: SendOptions = {},
): Promise<SendResult> {
  const token = env.telegramBotToken;
  const kind = options.kind ?? "generic";
  if (!token) {
    return { ok: false, error: "telegram-not-configured" };
  }
  const notification = await prisma.telegramNotification.create({
    data: {
      chatId,
      kind,
      payload: JSON.stringify({ text, replyMarkup: options.replyMarkup ?? null, disablePreview: !!options.disablePreview }),
      status: "PENDING",
    },
  });

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: options.disablePreview ?? true,
  };
  if (options.replyMarkup) payload.reply_markup = options.replyMarkup;

  let attempts = 0;
  let lastError: string | undefined;
  for (let i = 0; i < 3; i++) {
    attempts += 1;
    const result = await callTelegram(token, "sendMessage", payload);
    if (result.ok) {
      await prisma.telegramNotification.update({
        where: { id: notification.id },
        data: { status: "SENT", attempts, sentAt: new Date(), lastError: null },
      });
      return { ok: true };
    }
    lastError = result.description ?? `http-${result.status}`;
    if (result.retryAfter) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(result.retryAfter! * 1000, 5000)));
    } else if (i < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  await prisma.telegramNotification.update({
    where: { id: notification.id },
    data: { status: "FAILED", attempts, lastError: lastError?.slice(0, 500) ?? "unknown" },
  });
  return { ok: false, error: lastError };
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = env.telegramBotToken;
  if (!token) return;
  await callTelegram(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 180),
    show_alert: false,
  });
}

export async function setTelegramWebhook(url: string, secret: string): Promise<{ ok: boolean; description?: string }> {
  const token = env.telegramBotToken;
  if (!token) return { ok: false, description: "telegram-not-configured" };
  const result = await callTelegram(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });
  return { ok: result.ok, description: result.description };
}

/** Retry pending/failed notifications. Used by the protected maintenance endpoint. */
export async function retryPendingNotifications(limit = 25): Promise<{ sent: number; failed: number }> {
  const token = env.telegramBotToken;
  if (!token) return { sent: 0, failed: 0 };
  const rows = await prisma.telegramNotification.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 8 } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    let payload: { text?: string; replyMarkup?: InlineKeyboard | null; disablePreview?: boolean };
    try {
      payload = JSON.parse(row.payload) as typeof payload;
    } catch {
      await prisma.telegramNotification.update({
        where: { id: row.id },
        data: { status: "FAILED", lastError: "invalid-payload" },
      });
      failed += 1;
      continue;
    }
    if (!payload.text) continue;
    const result = await callTelegram(token, "sendMessage", {
      chat_id: row.chatId,
      text: payload.text,
      parse_mode: "HTML",
      disable_web_page_preview: payload.disablePreview ?? true,
      ...(payload.replyMarkup ? { reply_markup: payload.replyMarkup } : {}),
    });
    await prisma.telegramNotification.update({
      where: { id: row.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        attempts: row.attempts + 1,
        lastError: result.ok ? null : (result.description ?? "unknown").slice(0, 500),
        sentAt: result.ok ? new Date() : null,
      },
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

export function miniAppUrl(locale: Locale, path = ""): string {
  return `${env.siteUrl}/${locale}${path}`;
}

/**
 * Telegram only accepts `web_app` buttons over HTTPS. For local HTTP testing
 * return null so callers can omit the button instead of failing the message.
 */
export function telegramMiniAppButton(
  text: string,
  url: string,
): { text: string; web_app: { url: string } } | null {
  if (!url.startsWith("https://")) return null;
  return { text, web_app: { url } };
}
