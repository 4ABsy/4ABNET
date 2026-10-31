import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/constants";

describe("order status transitions", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAYMENT_REVIEW")).toBe(true);
    expect(canTransition("PAYMENT_REVIEW", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "REFUNDED")).toBe(true);
  });

  it("allows COD confirmation without a payment review step", () => {
    expect(canTransition("AWAITING_CONFIRMATION", "CONFIRMED")).toBe(true);
    expect(canTransition("AWAITING_CONFIRMATION", "CANCELLED")).toBe(true);
  });

  it("blocks terminal states from changing", () => {
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("REFUNDED", "DELIVERED")).toBe(false);
  });

  it("blocks skipping delivery or payment steps", () => {
    expect(canTransition("AWAITING_PAYMENT", "CONFIRMED")).toBe(false);
    expect(canTransition("AWAITING_PAYMENT", "DELIVERED")).toBe(false);
    expect(canTransition("CONFIRMED", "REFUNDED")).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(canTransition("UNKNOWN", "CONFIRMED")).toBe(false);
    expect(canTransition("CONFIRMED", "UNKNOWN")).toBe(false);
  });
});
