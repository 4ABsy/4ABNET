import type { NextRequest } from "next/server";
import { Prisma, type AdminPermission, type AdminUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { apiError, apiOk, requestIp } from "@/lib/api";
import { createI18n } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/constants";
import { hasPermission, type AdminContext } from "@/lib/auth";
import {
  answerCallbackQuery,
  miniAppUrl,
  parseOrderCallback,
  secretMatches,
  sendTelegramMessage,
  telegramLocale,
  telegramMiniAppButton,
  type TelegramUser,
} from "@/lib/telegram";
import {
  OrderError,
  cancelOrder,
  confirmPayment,
  transitionOrder,
} from "@/lib/orders";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChatInfo = {
  id: number;
  type?: string;
};

type TelegramMessage = {
  message_id?: number;
  from?: TelegramUser;
  chat?: TelegramChatInfo;
  text?: string;
};

type TelegramCallbackQuery = {
  id: string;
  from?: TelegramUser;
  data?: string;
  message?: { chat?: TelegramChatInfo };
};

type TelegramUpdatePayload = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function adminContext(admin: AdminUser & { permissions: AdminPermission[] }): AdminContext {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    permissions: admin.permissions.map((permission) => permission.permission),
    sessionId: "telegram",
  };
}

function localizedFor(user: TelegramUser | undefined, chatLocale: string | undefined) {
  const locale = chatLocale
    ? normalizeLocale(chatLocale)
    : telegramLocale(user ?? { id: 0, language_code: undefined });
  return createI18n(locale);
}

async function chatLocale(chatId: string | undefined): Promise<string | undefined> {
  if (!chatId) return undefined;
  const chat = await prisma.telegramChat.findUnique({ where: { chatId } });
  return chat?.locale;
}

function callbackErrorKey(error: unknown): string {
  if (error instanceof OrderError) {
    if (error.code === "PAYMENT_NOT_VERIFIED") return "telegram.paymentNotVerified";
    if (error.code === "INVALID_TRANSITION") return "telegram.invalidState";
    if (error.code === "ALREADY_UPDATED") return "telegram.alreadyUpdated";
    if (error.code === "NOT_FOUND") return "telegram.callbackFailed";
  }
  return "telegram.callbackFailed";
}

async function handleStart(message: TelegramMessage) {
  const from = message.from;
  const chat = message.chat;
  if (!from || !chat) return;

  const locale = telegramLocale(from);
  const { t } = createI18n(locale);
  const chatId = String(chat.id);

  await prisma.telegramChat.upsert({
    where: { chatId },
    create: { chatId, locale },
    update: { locale },
  });

  const buttons = [
    telegramMiniAppButton(`🛍 ${t("telegram.openStore")}`, miniAppUrl(locale, "")),
    telegramMiniAppButton(`📦 ${t("order.trackOrder")}`, miniAppUrl(locale, "/track")),
  ].filter((button) => button !== null);

  if (chat.type === "private") {
    const admin = await prisma.adminUser.findUnique({
      where: { telegramId: String(from.id) },
      select: { id: true, status: true },
    });
    if (admin?.status === "ACTIVE") {
      const adminButton = telegramMiniAppButton(
        `🛠 ${t("telegram.openAdmin")}`,
        miniAppUrl(locale, "/admin/telegram-login"),
      );
      if (adminButton) buttons.push(adminButton);
    }
  }

  // Local HTTP cannot render Mini App buttons; send a plain text menu instead.
  const replyMarkup = buttons.length
    ? { inline_keyboard: buttons.map((button) => [button]) }
    : undefined;
  const welcome = buttons.length
    ? t("telegram.botWelcome")
    : `${t("telegram.botWelcome")}\n\n${env.siteUrl}/${locale}`;

  await sendTelegramMessage(chatId, welcome, {
    kind: "bot-start",
    replyMarkup,
    disablePreview: true,
  });
}

async function handleCallback(query: TelegramCallbackQuery, ip: string) {
  const from = query.from;
  const parsed = parseOrderCallback(query.data);
  const responseChatId = query.message?.chat?.id ?? from?.id;
  const locale = await chatLocale(responseChatId ? String(responseChatId) : undefined);
  const { t } = localizedFor(from, locale);

  if (!from || !parsed) {
    await answerCallbackQuery(query.id, t("telegram.callbackFailed"));
    return;
  }

  const admin = await prisma.adminUser.findUnique({
    where: { telegramId: String(from.id) },
    include: { permissions: true },
  });

  if (!admin || admin.status !== "ACTIVE") {
    await answerCallbackQuery(query.id, t("telegram.notAuthorized"));
    await recordAudit({
      actorType: "TELEGRAM",
      action: "telegram.callback.denied",
      entityType: "Order",
      entityId: parsed.orderId,
      details: { reason: "not-an-authorised-admin", action: parsed.action },
      ip,
      success: false,
    });
    return;
  }

  const ctx = adminContext(admin);
  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    await answerCallbackQuery(query.id, t("telegram.callbackFailed"));
    return;
  }

  const needsPaymentReview = parsed.action === "confirm" && order.status === "PAYMENT_REVIEW";
  const allowed =
    hasPermission(ctx, "orders.confirm") &&
    (!needsPaymentReview || hasPermission(ctx, "payments.review"));

  if (!allowed) {
    await answerCallbackQuery(query.id, t("telegram.notAuthorized"));
    await recordAudit({
      adminId: admin.id,
      actorType: "TELEGRAM",
      action: "telegram.callback.denied",
      entityType: "Order",
      entityId: order.id,
      details: { reason: "missing-permission", action: parsed.action, status: order.status },
      ip,
      success: false,
    });
    return;
  }

  const actor = { type: "TELEGRAM" as const, adminId: admin.id, ip };

  try {
    if (parsed.action === "cancel") {
      await cancelOrder(order.id, actor, "telegram-cancelled");
      await answerCallbackQuery(query.id, t("telegram.callbackCancelled"));
      return;
    }

    if (order.status === "PAYMENT_REVIEW") {
      await confirmPayment(order.id, actor, "telegram-payment-verified");
    } else {
      await transitionOrder(order.id, "CONFIRMED", actor, "telegram-confirmed");
    }
    await answerCallbackQuery(query.id, t("telegram.callbackConfirmed"));
  } catch (error) {
    const code = error instanceof OrderError ? error.code : "UNKNOWN";
    await answerCallbackQuery(query.id, t(callbackErrorKey(error)));
    await recordAudit({
      adminId: admin.id,
      actorType: "TELEGRAM",
      action: "telegram.callback.failed",
      entityType: "Order",
      entityId: order.id,
      details: { action: parsed.action, code },
      ip,
      success: false,
    });
  }
}

async function handleMessage(message: TelegramMessage) {
  const text = message.text?.trim();
  if (!text) return;
  const command = text.split(/\s+/)[0]?.split("@")[0]?.toLowerCase();
  if (command === "/start" || command === "/help") {
    await handleStart(message);
  }
}

export async function POST(request: NextRequest) {
  const secret = env.telegramWebhookSecret;
  if (!env.isTelegramConfigured || !secret) {
    return apiError(503, "NOT_CONFIGURED");
  }

  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secretMatches(provided, secret)) {
    return apiError(401, "UNAUTHORIZED");
  }

  let update: TelegramUpdatePayload;
  try {
    update = (await request.json()) as TelegramUpdatePayload;
  } catch {
    return apiError(400, "INVALID_UPDATE");
  }

  if (typeof update.update_id !== "number") {
    return apiError(400, "INVALID_UPDATE");
  }

  try {
    await prisma.telegramUpdate.create({ data: { updateId: String(update.update_id) } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiOk({ duplicate: true });
    }
    console.error("[telegram] could not persist update", error);
    return apiError(500, "INTERNAL_ERROR");
  }

  const ip = requestIp(request.headers);
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, ip);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (error) {
    // The update is already recorded for idempotency. Log the failure and
    // acknowledge so Telegram does not replay a partially applied action.
    console.error("[telegram] update processing failed", update.update_id, error);
  }

  return apiOk({ processed: true });
}
