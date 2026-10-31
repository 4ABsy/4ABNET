import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/auth";
import { couponValidateSchema } from "@/lib/validation";
import { OrderError, quoteCart } from "@/lib/orders";
import { checkCoupon } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { apiError, apiOk, errorResponse, requestIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preview a coupon against the server-priced cart. Read-only: it never reserves
 * stock or increments usage; the order endpoint re-validates everything.
 */
export async function POST(request: NextRequest) {
  try {
    await assertSameOrigin();
  } catch (error) {
    return errorResponse(error);
  }

  const ip = requestIp(request.headers);
  const limit = rateLimit(`coupon:validate:${ip}`, 20, 60_000);
  if (!limit.allowed) return apiError(429, "RATE_LIMITED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON");
  }

  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR");

  try {
    const quote = await quoteCart(parsed.data.items, "ar");
    const result = await checkCoupon(prisma, parsed.data.code, quote.subtotalMinor);
    if (!result.ok) {
      return apiError(
        400,
        result.code,
        result.minSubtotalMinor !== undefined
          ? { minSubtotalMinor: result.minSubtotalMinor }
          : undefined,
      );
    }

    return apiOk({
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        percentBasisPoints: result.coupon.percentBasisPoints,
        amountMinor: result.coupon.amountMinor,
        expiresAt: result.coupon.expiresAt?.toISOString() ?? null,
      },
      subtotalMinor: quote.subtotalMinor,
      discountMinor: result.discountMinor,
      totalMinor: result.totalMinor,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return apiError(error.status, error.code, error.meta);
    }
    return errorResponse(error);
  }
}

export function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
