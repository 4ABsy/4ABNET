import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/orders";

describe("phone normalization", () => {
  it("normalizes Turkish local and international formats", () => {
    expect(normalizePhone("0532 123 45 67")).toBe("+905321234567");
    expect(normalizePhone("5321234567")).toBe("+905321234567");
    expect(normalizePhone("+90 532 123 45 67")).toBe("+905321234567");
    expect(normalizePhone("905321234567")).toBe("+905321234567");
  });

  it("keeps other international numbers in E.164-like form", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("0090 532 123 45 67")).toBe("+905321234567");
  });

  it("rejects empty, too short, too long and misplaced plus numbers", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("1234567890123456")).toBeNull();
    expect(normalizePhone("12+3456789")).toBeNull();
    expect(normalizePhone("not-a-phone")).toBeNull();
  });
});
