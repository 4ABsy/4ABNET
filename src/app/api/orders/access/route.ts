import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/auth";
import { normalizePhone } from "@/lib/orders";
import { setOrderAccessCookie } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { trackSchema } from "@/lib/validation";
import { apiError, apiOk, errorResponse, requestIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await assertSameOrigin();
  } catch (error) {
    return errorResponse(error);
  }

  const ip = requestIp(request.headers);
  const limit = rateLimit(`order:track:${ip}`, 10, 10 * 60_000);
  if (!limit.allowed) return apiError(429, "RATE_LIMITED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON");
  }
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "INVALID_TRACKING_DETAILS");

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(400, "INVALID_TRACKING_DETAILS");

  const order = await prisma.order.findUnique({
    where: { reference: parsed.data.reference.trim().toUpperCase() },
    select: { reference: true, customerPhone: true },
  });
  if (!order || order.customerPhone !== phone) {
    // Deliberately identical response for unknown reference and wrong phone.
    return apiError(404, "TRACKING_NOT_FOUND");
  }

  await setOrderAccessCookie(order.reference);
  return apiOk({ reference: order.reference });
}
