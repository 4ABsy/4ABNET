import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { apiError, apiOk, requestIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTelegramInitData } from "@/lib/telegram";
import { normalizePhone } from "@/lib/orders";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkBody = {
  initData?: unknown;
  reference?: unknown;
  phone?: unknown;
};

function trimmedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Link an order's customer record to a verified Telegram account.
 *
 * Access requires both the public order reference and the phone number used at
 * checkout, and the Mini App initData must be signed by the configured bot.
 * Order contents, status and delivery data are never returned here.
 */
export async function POST(request: NextRequest) {
  if (!env.isTelegramConfigured) {
    return apiError(503, "NOT_CONFIGURED");
  }

  const ip = requestIp(request.headers);
  const ipLimit = rateLimit(`telegram-link:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!ipLimit.allowed) {
    return apiError(429, "RATE_LIMITED", { retryAfter: ipLimit.retryAfterSeconds });
  }

  let body: LinkBody;
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return apiError(400, "INVALID_BODY");
  }

  const initData = trimmedString(body.initData, 8192);
  const reference = trimmedString(body.reference, 32).toUpperCase();
  const phoneInput = trimmedString(body.phone, 32);

  if (!initData || reference.length < 6 || !phoneInput) {
    return apiError(400, "INVALID_INPUT");
  }

  const verified = verifyTelegramInitData(initData, env.telegramBotToken as string);
  if (!verified) {
    return apiError(401, "TELEGRAM_INVALID");
  }

  const telegramId = String(verified.user.id);
  const userLimit = rateLimit(`telegram-link:user:${telegramId}`, 6, 10 * 60 * 1000);
  if (!userLimit.allowed) {
    return apiError(429, "RATE_LIMITED", { retryAfter: userLimit.retryAfterSeconds });
  }

  const phone = normalizePhone(phoneInput);
  if (!phone) {
    return apiError(400, "PHONE_INVALID");
  }

  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      customerId: true,
      customerPhone: true,
      customer: { select: { id: true, telegramId: true } },
    },
  });

  // A generic response prevents order/reference enumeration.
  if (!order || order.customerPhone !== phone) {
    return apiError(404, "NOT_FOUND");
  }

  if (order.customer.telegramId && order.customer.telegramId !== telegramId) {
    return apiError(409, "TELEGRAM_ALREADY_LINKED");
  }

  const otherCustomer = await prisma.customer.findFirst({
    where: { telegramId, id: { not: order.customerId } },
    select: { id: true },
  });
  if (otherCustomer) {
    return apiError(409, "TELEGRAM_IN_USE");
  }

  try {
    // Conditional update prevents a concurrent request from replacing another
    // Telegram identity after the checks above.
    const updated = await prisma.customer.updateMany({
      where: {
        id: order.customerId,
        OR: [{ telegramId: null }, { telegramId }],
      },
      data: {
        telegramId,
        telegramUsername: verified.user.username?.slice(0, 64) ?? null,
      },
    });
    if (updated.count !== 1) {
      return apiError(409, "TELEGRAM_ALREADY_LINKED");
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiError(409, "TELEGRAM_IN_USE");
    }
    console.error("[telegram] customer link failed", error);
    return apiError(500, "INTERNAL_ERROR");
  }

  await recordAudit({
    actorType: "TELEGRAM",
    action: "telegram.customer.linked",
    entityType: "Customer",
    entityId: order.customerId,
    details: { orderReference: order.reference },
    ip,
  });

  return apiOk({ linked: true });
}
