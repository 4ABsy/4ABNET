/**
 * Pure coupon rules shared by the storefront, checkout API and admin.
 * Kept free of Prisma/server-only imports so it can be unit tested directly.
 */

export const COUPON_TYPES = ["PERCENT", "FIXED"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export type CouponErrorCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_INACTIVE"
  | "COUPON_NOT_STARTED"
  | "COUPON_EXPIRED"
  | "COUPON_EXHAUSTED"
  | "COUPON_MIN_SUBTOTAL"
  | "COUPON_CUSTOMER_LIMIT"
  | "COUPON_INVALID";

export type CouponState = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED" | "EXHAUSTED";

export type CouponRule = {
  code: string;
  type: string;
  percentBasisPoints: number | null;
  amountMinor: number | null;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

export type CouponCheck =
  | { ok: true; discountMinor: number; totalMinor: number }
  | { ok: false; code: CouponErrorCode; minSubtotalMinor?: number };

/** Uppercase, trim, and remove internal whitespace so "save 10" === "SAVE10". */
export function normalizeCouponCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").slice(0, 32);
}

export function isValidCouponCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code);
}

/**
 * Integer discount in kuruş. Percentage discounts round down (in the store's
 * favour) and are capped by `maxDiscountMinor` and by the subtotal itself.
 */
export function couponDiscountMinor(coupon: CouponRule, subtotalMinor: number): number {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor <= 0) return 0;
  let discount = 0;
  if (coupon.type === "PERCENT") {
    const bps = coupon.percentBasisPoints ?? 0;
    if (!Number.isInteger(bps) || bps <= 0 || bps > 10000) return 0;
    discount = Math.floor((subtotalMinor * bps) / 10000);
  } else if (coupon.type === "FIXED") {
    const amount = coupon.amountMinor ?? 0;
    if (!Number.isInteger(amount) || amount <= 0) return 0;
    discount = amount;
  }
  if (coupon.maxDiscountMinor !== null && coupon.maxDiscountMinor > 0) {
    discount = Math.min(discount, coupon.maxDiscountMinor);
  }
  return Math.max(0, Math.min(discount, subtotalMinor));
}

/** Why a coupon is or is not currently usable, for admin badges and filters. */
export function couponState(coupon: CouponRule, now: Date = new Date()): CouponState {
  if (!coupon.isActive) return "DISABLED";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return "SCHEDULED";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return "EXHAUSTED";
  return "ACTIVE";
}

/**
 * Validate a coupon for a given subtotal. `customerUsageCount` is the number of
 * non-cancelled orders already placed by this customer with the same coupon.
 */
export function evaluateCoupon(
  coupon: CouponRule,
  context: {
    subtotalMinor: number;
    customerUsageCount?: number;
    now?: Date;
  },
): CouponCheck {
  const now = context.now ?? new Date();
  const subtotal = context.subtotalMinor;

  if (!coupon.isActive) return { ok: false, code: "COUPON_INACTIVE" };
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    return { ok: false, code: "COUPON_NOT_STARTED" };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: "COUPON_EXPIRED" };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, code: "COUPON_EXHAUSTED" };
  }
  if (subtotal < coupon.minSubtotalMinor) {
    return {
      ok: false,
      code: "COUPON_MIN_SUBTOTAL",
      minSubtotalMinor: coupon.minSubtotalMinor,
    };
  }
  if (
    coupon.perCustomerLimit !== null &&
    (context.customerUsageCount ?? 0) >= coupon.perCustomerLimit
  ) {
    return { ok: false, code: "COUPON_CUSTOMER_LIMIT" };
  }

  const discountMinor = couponDiscountMinor(coupon, subtotal);
  if (discountMinor <= 0) return { ok: false, code: "COUPON_INVALID" };

  return {
    ok: true,
    discountMinor,
    totalMinor: Math.max(0, subtotal - discountMinor),
  };
}
