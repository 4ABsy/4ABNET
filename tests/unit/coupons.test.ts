import { describe, expect, it } from "vitest";
import {
  couponDiscountMinor,
  couponState,
  evaluateCoupon,
  isValidCouponCode,
  normalizeCouponCode,
  type CouponRule,
} from "@/lib/coupon-rules";

function coupon(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    code: "SAVE10",
    type: "PERCENT",
    percentBasisPoints: 1000,
    amountMinor: null,
    minSubtotalMinor: 0,
    maxDiscountMinor: null,
    usageLimit: null,
    perCustomerLimit: 1,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    ...overrides,
  };
}

describe("coupon code normalization", () => {
  it("uppercases, trims, and removes internal whitespace", () => {
    expect(normalizeCouponCode("  save 10 ")).toBe("SAVE10");
    expect(normalizeCouponCode("eid-2026")).toBe("EID-2026");
  });

  it("caps the stored code at 32 characters", () => {
    expect(normalizeCouponCode("A".repeat(40))).toHaveLength(32);
  });

  it("accepts 3-32 letters, digits, dashes, underscores", () => {
    expect(isValidCouponCode("AB1")).toBe(true);
    expect(isValidCouponCode("SAVE_10-X")).toBe(true);
    expect(isValidCouponCode("AB")).toBe(false);
    expect(isValidCouponCode("SAVE 10")).toBe(false);
    expect(isValidCouponCode("-SAVE10")).toBe(false);
    expect(isValidCouponCode("SAVE.10")).toBe(false);
  });
});

describe("coupon discount math", () => {
  it("computes percentage discounts in integer kuruş", () => {
    expect(couponDiscountMinor(coupon(), 19900)).toBe(1990);
    expect(couponDiscountMinor(coupon({ percentBasisPoints: 1250 }), 20000)).toBe(2500);
  });

  it("rounds percentage discounts down to the kuruş", () => {
    // 3.33% of 100 kuruş = 3.33 -> 3
    expect(couponDiscountMinor(coupon({ percentBasisPoints: 333 }), 100)).toBe(3);
  });

  it("applies a maximum discount cap", () => {
    expect(
      couponDiscountMinor(coupon({ percentBasisPoints: 5000, maxDiscountMinor: 1500 }), 10000),
    ).toBe(1500);
  });

  it("never discounts more than the subtotal", () => {
    expect(couponDiscountMinor(coupon({ type: "FIXED", amountMinor: 50000 }), 19900)).toBe(19900);
    expect(couponDiscountMinor(coupon({ percentBasisPoints: 10000 }), 5000)).toBe(5000);
  });

  it("returns zero for invalid configuration or empty carts", () => {
    expect(couponDiscountMinor(coupon({ percentBasisPoints: 0 }), 10000)).toBe(0);
    expect(couponDiscountMinor(coupon({ percentBasisPoints: 10001 }), 10000)).toBe(0);
    expect(couponDiscountMinor(coupon({ type: "FIXED", amountMinor: 0 }), 10000)).toBe(0);
    expect(couponDiscountMinor(coupon(), 0)).toBe(0);
    expect(couponDiscountMinor(coupon(), -100)).toBe(0);
  });

  it("supports fixed-amount coupons", () => {
    expect(couponDiscountMinor(coupon({ type: "FIXED", amountMinor: 2500 }), 19900)).toBe(2500);
  });
});

describe("coupon eligibility", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("accepts a valid coupon and returns the payable total", () => {
    const result = evaluateCoupon(coupon(), { subtotalMinor: 19900, now });
    expect(result).toEqual({ ok: true, discountMinor: 1990, totalMinor: 17910 });
  });

  it("rejects inactive coupons", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), { subtotalMinor: 19900, now })).toEqual({
      ok: false,
      code: "COUPON_INACTIVE",
    });
  });

  it("rejects coupons before their start date", () => {
    const startsAt = new Date("2026-07-01T00:00:00.000Z");
    expect(evaluateCoupon(coupon({ startsAt }), { subtotalMinor: 19900, now })).toEqual({
      ok: false,
      code: "COUPON_NOT_STARTED",
    });
  });

  it("rejects expired coupons", () => {
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");
    expect(evaluateCoupon(coupon({ expiresAt }), { subtotalMinor: 19900, now })).toEqual({
      ok: false,
      code: "COUPON_EXPIRED",
    });
  });

  it("treats the expiry instant itself as expired", () => {
    const expiresAt = new Date(now);
    expect(evaluateCoupon(coupon({ expiresAt }), { subtotalMinor: 19900, now })).toEqual({
      ok: false,
      code: "COUPON_EXPIRED",
    });
  });

  it("rejects coupons whose usage limit is reached", () => {
    expect(
      evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), { subtotalMinor: 19900, now }),
    ).toEqual({ ok: false, code: "COUPON_EXHAUSTED" });
  });

  it("enforces the minimum subtotal and reports the threshold", () => {
    expect(
      evaluateCoupon(coupon({ minSubtotalMinor: 30000 }), { subtotalMinor: 19900, now }),
    ).toEqual({ ok: false, code: "COUPON_MIN_SUBTOTAL", minSubtotalMinor: 30000 });
  });

  it("enforces the per-customer limit", () => {
    expect(
      evaluateCoupon(coupon({ perCustomerLimit: 2 }), {
        subtotalMinor: 19900,
        customerUsageCount: 2,
        now,
      }),
    ).toEqual({ ok: false, code: "COUPON_CUSTOMER_LIMIT" });
  });

  it("allows unlimited per-customer use when the limit is null", () => {
    const result = evaluateCoupon(coupon({ perCustomerLimit: null }), {
      subtotalMinor: 19900,
      customerUsageCount: 50,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a coupon that yields no discount", () => {
    expect(
      evaluateCoupon(coupon({ type: "FIXED", amountMinor: 100 }), { subtotalMinor: 0, now }),
    ).toEqual({ ok: false, code: "COUPON_INVALID" });
  });
});

describe("coupon state labels", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("reports the lifecycle state in precedence order", () => {
    expect(couponState(coupon(), now)).toBe("ACTIVE");
    expect(couponState(coupon({ isActive: false }), now)).toBe("DISABLED");
    expect(couponState(coupon({ expiresAt: new Date("2026-01-01T00:00:00Z") }), now)).toBe(
      "EXPIRED",
    );
    expect(couponState(coupon({ startsAt: new Date("2026-12-01T00:00:00Z") }), now)).toBe(
      "SCHEDULED",
    );
    expect(couponState(coupon({ usageLimit: 1, usedCount: 1 }), now)).toBe("EXHAUSTED");
  });
});
