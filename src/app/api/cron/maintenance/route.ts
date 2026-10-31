import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { apiError, apiOk } from "@/lib/api";
import { releaseExpiredReservations } from "@/lib/orders";
import { retryPendingNotifications, secretMatches } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function authorized(request: NextRequest): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return secretMatches(match?.[1] ?? null, secret);
}

async function runMaintenance() {
  const now = new Date();

  const reservationsReleased = await releaseExpiredReservations();

  const notifications = await retryPendingNotifications(25);

  const [sessions, loginTokens, updates, sentNotifications] = await Promise.all([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.adminLoginToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null, lt: new Date(now.getTime() - DAY_MS) } }],
      },
    }),
    prisma.telegramUpdate.deleteMany({
      where: { processedAt: { lt: new Date(now.getTime() - 7 * DAY_MS) } },
    }),
    prisma.telegramNotification.deleteMany({
      where: { status: "SENT", sentAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
    }),
  ]);

  return {
    reservationsReleased,
    notifications,
    pruned: {
      sessions: sessions.count,
      loginTokens: loginTokens.count,
      telegramUpdates: updates.count,
      sentNotifications: sentNotifications.count,
    },
  };
}

async function handle(request: NextRequest) {
  if (!env.cronSecret) {
    return apiError(503, "NOT_CONFIGURED");
  }
  if (!authorized(request)) {
    return apiError(401, "UNAUTHORIZED");
  }

  try {
    const result = await runMaintenance();
    return apiOk(result);
  } catch (error) {
    console.error("[cron] maintenance failed", error);
    return apiError(500, "INTERNAL_ERROR");
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
