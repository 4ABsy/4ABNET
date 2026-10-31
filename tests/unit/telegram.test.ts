import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseOrderCallback,
  secretMatches,
  telegramLocale,
  verifyTelegramInitData,
} from "@/lib/telegram";

const BOT_TOKEN = "123456:TEST-TOKEN-NOT-REAL";
const NOW = 1_700_000_000;

function buildInitData(
  options: {
    token?: string;
    authDate?: number;
    user?: Record<string, unknown>;
    extra?: Record<string, string>;
    tamper?: boolean;
  } = {},
): string {
  const params = new URLSearchParams();
  params.set("auth_date", String(options.authDate ?? NOW - 60));
  params.set("query_id", "AAH-test-query");
  params.set(
    "user",
    JSON.stringify(options.user ?? { id: 987654321, first_name: "Test", language_code: "tr" }),
  );
  for (const [key, value] of Object.entries(options.extra ?? {})) {
    params.set(key, value);
  }

  const entries = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(options.token ?? BOT_TOKEN).digest();
  let hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (options.tamper) {
    hash = `${hash.slice(0, -1)}${hash.endsWith("a") ? "b" : "a"}`;
  }
  params.set("hash", hash);
  return params.toString();
}

describe("Telegram initData verification", () => {
  it("accepts correctly signed initData", () => {
    const result = verifyTelegramInitData(buildInitData(), BOT_TOKEN, 3600, NOW);
    expect(result?.user.id).toBe(987654321);
    expect(result?.authDate).toBe(NOW - 60);
    expect(result?.queryId).toBe("AAH-test-query");
  });

  it("rejects a different bot token", () => {
    expect(verifyTelegramInitData(buildInitData(), "999:OTHER", 3600, NOW)).toBeNull();
  });

  it("rejects tampered signatures", () => {
    expect(verifyTelegramInitData(buildInitData({ tamper: true }), BOT_TOKEN, 3600, NOW)).toBeNull();
  });

  it("rejects expired and far-future auth dates", () => {
    expect(
      verifyTelegramInitData(buildInitData({ authDate: NOW - 7200 }), BOT_TOKEN, 3600, NOW),
    ).toBeNull();
    expect(
      verifyTelegramInitData(buildInitData({ authDate: NOW + 3600 }), BOT_TOKEN, 3600, NOW),
    ).toBeNull();
  });

  it("rejects malformed or missing data", () => {
    expect(verifyTelegramInitData("", BOT_TOKEN, 3600, NOW)).toBeNull();
    expect(verifyTelegramInitData("hash=abc", BOT_TOKEN, 3600, NOW)).toBeNull();
    expect(
      verifyTelegramInitData(
        buildInitData({ user: { first_name: "missing id" } }),
        BOT_TOKEN,
        3600,
        NOW,
      ),
    ).toBeNull();
  });
});

describe("Telegram helpers", () => {
  it("parses only strict order callbacks", () => {
    expect(parseOrderCallback("ord:confirm:abcde12345")).toEqual({
      action: "confirm",
      orderId: "abcde12345",
    });
    expect(parseOrderCallback("ord:cancel:ABC_123-xy")).toEqual({
      action: "cancel",
      orderId: "ABC_123-xy",
    });
    expect(parseOrderCallback("ord:delete:abcde")).toBeNull();
    expect(parseOrderCallback("ord:confirm:abc")).toBeNull();
    expect(parseOrderCallback("ord:confirm:abcde;drop")).toBeNull();
    expect(parseOrderCallback(undefined)).toBeNull();
  });

  it("compares webhook secrets without length leaks", () => {
    expect(secretMatches("correct-secret", "correct-secret")).toBe(true);
    expect(secretMatches("wrong-secret", "correct-secret")).toBe(false);
    expect(secretMatches("short", "a-much-longer-secret")).toBe(false);
    expect(secretMatches(null, "secret")).toBe(false);
  });

  it("maps Telegram language codes to supported locales", () => {
    expect(telegramLocale({ language_code: "ar" })).toBe("ar");
    expect(telegramLocale({ language_code: "en-US" })).toBe("en");
    expect(telegramLocale({ language_code: "tr" })).toBe("tr");
    expect(telegramLocale({ language_code: "de" })).toBe("ar");
    expect(telegramLocale({})).toBe("ar");
  });
});
