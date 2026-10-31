import { describe, expect, it } from "vitest";
import { discountPercent, formatMoney, lineTotal } from "@/lib/money";

describe("money helpers", () => {
  it("formats integer minor units as two-decimal currency", () => {
    const formatted = formatMoney(123456).replace(/\s/g, "");
    expect(formatted).toMatch(/1[.,]234[.,]56/);
  });

  it("formats one kuruş without floating point loss", () => {
    const formatted = formatMoney(1).replace(/\s/g, "");
    expect(formatted).toMatch(/0[.,]01/);
  });

  it("computes exact line totals", () => {
    expect(lineTotal(19900, 3)).toBe(59700);
    expect(lineTotal(1, 10)).toBe(10);
  });

  it("rejects invalid prices and quantities", () => {
    expect(() => lineTotal(-1, 1)).toThrow();
    expect(() => lineTotal(1.5, 1)).toThrow();
    expect(() => lineTotal(100, 0)).toThrow();
    expect(() => lineTotal(100, 1.2)).toThrow();
  });

  it("calculates a rounded discount percentage", () => {
    expect(discountPercent(7500, 10000)).toBe(25);
    expect(discountPercent(10000, 10000)).toBe(0);
    expect(discountPercent(12000, 10000)).toBe(0);
    expect(discountPercent(10000, null)).toBe(0);
  });
});
