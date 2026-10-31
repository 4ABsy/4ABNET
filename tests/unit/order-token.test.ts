import { beforeAll, describe, expect, it } from "vitest";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-token";

beforeAll(() => {
  process.env.APP_SECRET = "test-secret-value-that-is-long-enough-for-hmac";
});

describe("order access tokens", () => {
  it("round-trips a valid order reference", () => {
    const token = createOrderAccessToken("4AB-ABCDEFGH");
    expect(verifyOrderAccessToken(token)).toBe("4AB-ABCDEFGH");
  });

  it("rejects tampered payloads and signatures", () => {
    const token = createOrderAccessToken("4AB-ABCDEFGH");
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ref: "4AB-OTHERVAL", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    expect(verifyOrderAccessToken(`${forgedPayload}.${signature}`)).toBeNull();
    expect(verifyOrderAccessToken(`${payload}.${signature?.slice(0, -1)}x`)).toBeNull();
  });

  it("rejects expired and malformed tokens", () => {
    expect(verifyOrderAccessToken(createOrderAccessToken("4AB-ABCDEFGH", -1))).toBeNull();
    expect(verifyOrderAccessToken("not-a-token")).toBeNull();
    expect(verifyOrderAccessToken("")).toBeNull();
    expect(verifyOrderAccessToken(null)).toBeNull();
  });
});
