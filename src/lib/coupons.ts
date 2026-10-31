import "server-only";
import { Prisma, type Coupon } from "@prisma/client";
import {
  evaluateCoupon,
  isValidCouponCode,
  normalizeCouponCode,
  type CouponErrorCode,
} from "@/lib/coupon-rules";

type Db = Prisma.TransactionClient;

export type CouponCheckResult =
  | { ok: true; coupon: Coupon; discountMinor: number; totalMinor: number }
  | { ok: false; code: CouponErrorCode; minSubtotalMinor?: number };

/** Normalize and look up a coupon by its public code. */
export async function findCouponByCode(db: Db, rawCode: string): Promise<Coupon | null> {
  const code = normalizeCouponCode(rawCode);
  if (!isValidCouponCode(code)) return null;
  return db.coupon.findUnique({ where: { code } });
}

/**
 * Validate a coupon against a subtotal and (optionally) the customer's phone.
 * Read-only: usage is only incremented inside the order transaction.
 */
export async function checkCoupon(
  db: Db,
  rawCode: string,
  subtotalMinor: number,
  options?: { customerPhone?: string | null; now?: Date },
): Promise<CouponCheckResult> {
  const coupon = await findCouponByCode(db, rawCode);
  if (!coupon) return { ok: false, code: "COUPON_NOT_FOUND" };

  let customerUsageCount = 0;
  if (options?.customerPhone && coupon.perCustomerLimit !== null) {
    customerUsageCount = await db.order.count({
      where: {
        couponId: coupon.id,
        status: { not: "CANCELLED" },
        customer: { phone: options.customerPhone },
      },
    });
  }

  const result = evaluateCoupon(coupon, {
    subtotalMinor,
    customerUsageCount,
    now: options?.now,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    coupon,
    discountMinor: result.discountMinor,
    totalMinor: result.totalMinor,
  };
}
