import { describe, expect, it } from "vitest";
import { PERMISSIONS, isPermission } from "@/lib/constants";
import { orderCreateSchema, passwordSchema, trackSchema } from "@/lib/validation";

describe("input validation", () => {
  it("accepts a valid order payload", () => {
    const result = orderCreateSchema.safeParse({
      items: [{ productId: "prod_1", quantity: 2 }],
      name: "Test Customer",
      phone: "0532 123 45 67",
      locale: "ar",
      paymentMethod: "BANK_TRANSFER",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing items, unsupported locales and unknown payment methods", () => {
    expect(
      orderCreateSchema.safeParse({
        items: [],
        name: "Test",
        phone: "05321234567",
        locale: "ar",
        paymentMethod: "BANK_TRANSFER",
      }).success,
    ).toBe(false);
    expect(
      orderCreateSchema.safeParse({
        items: [{ productId: "p", quantity: 1 }],
        name: "Test",
        phone: "05321234567",
        locale: "de",
        paymentMethod: "BANK_TRANSFER",
      }).success,
    ).toBe(false);
    expect(
      orderCreateSchema.safeParse({
        items: [{ productId: "p", quantity: 1 }],
        name: "Test",
        phone: "05321234567",
        locale: "ar",
        paymentMethod: "CARD",
      }).success,
    ).toBe(false);
  });

  it("limits quantities per line and in total", () => {
    expect(
      orderCreateSchema.safeParse({
        items: [{ productId: "p", quantity: 11 }],
        name: "Test",
        phone: "05321234567",
        locale: "ar",
        paymentMethod: "BANK_TRANSFER",
      }).success,
    ).toBe(false);
    expect(
      orderCreateSchema.safeParse({
        items: Array.from({ length: 21 }, () => ({ productId: "p", quantity: 1 })),
        name: "Test",
        phone: "05321234567",
        locale: "ar",
        paymentMethod: "BANK_TRANSFER",
      }).success,
    ).toBe(false);
  });

  it("validates tracking references and passwords", () => {
    expect(trackSchema.safeParse({ reference: "4AB-ABCDEFGH", phone: "05321234567" }).success).toBe(true);
    expect(trackSchema.safeParse({ reference: "abc", phone: "05321234567" }).success).toBe(false);
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a-long-enough-password").success).toBe(true);
  });
});

describe("permission catalogue", () => {
  it("recognizes only declared permissions", () => {
    for (const permission of PERMISSIONS) {
      expect(isPermission(permission)).toBe(true);
    }
    expect(isPermission("admins.everything")).toBe(false);
    expect(isPermission(null)).toBe(false);
  });

  it("has no duplicate permission keys", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});
