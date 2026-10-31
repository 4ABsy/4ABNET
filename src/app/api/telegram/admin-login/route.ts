import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { apiError, apiOk, requestIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTelegramInitData, telegramLocale } from "@/lib/telegram";
import { createAdminSession, setSessionCookie } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = { initData?: unknown };

/**
 * Administrator sign-in from the Telegram Mini App.
 *
 * The initData signature is verified server-side, then the Telegram user ID is
 * matched to an active administrator account. Knowing the bot, or being a
 * member of the admin chat, is never sufficient.
 */
export async function POST(request: NextRequest) {
  if (!env.isTelegramConfigured) {
    return apiError(503, "NOT_CONFIGURED");
  }

  const ip = requestIp(request.headers);
  const limit = rateLimit(`telegram-admin-login:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return apiError(429, "RATE_LIMITED", { retryAfter: limit.retryAfterSeconds });
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return apiError(400, "INVALID_BODY");
  }

  const initData = typeof body.initData === "string" ? body.initData.trim().slice(0, 8192) : "";
  if (!initData) return apiError(400, "INVALID_INPUT");

  const verified = verifyTelegramInitData(initData, env.telegramBotToken as string);
  if (!verified) {
    return apiError(401, "TELEGRAM_INVALID");
  }

  const userLimit = rateLimit(`telegram-admin-login:user:${verified.user.id}`, 6, 10 * 60 * 1000);
  if (!userLimit.allowed) {
    return apiError(429, "RATE_LIMITED", { retryAfter: userLimit.retryAfterSeconds });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { telegramId: String(verified.user.id) },
  });

  if (!admin || admin.status !== "ACTIVE") {
    await recordAudit({
      actorType: "TELEGRAM",
      action: "admin.login.telegram.denied",
      entityType: "AdminUser",
      details: { reason: "not-linked-or-inactive" },
      ip,
      success: false,
    });
    return apiError(403, "NOT_AUTHORIZED");
  }

  const { token } = await createAdminSession(admin.id, {
    ip,
    userAgent: request.headers.get("user-agent"),
  });
  await setSessionCookie(token);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  await recordAudit({
    adminId: admin.id,
    actorType: "TELEGRAM",
    action: "admin.login.telegram",
    entityType: "AdminUser",
    entityId: admin.id,
    details: { method: "telegram-mini-app" },
    ip,
  });

  return apiOk({
    redirect: `/${telegramLocale(verified.user)}/admin`,
  });
}
