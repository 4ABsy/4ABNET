import { describe, expect, it } from "vitest";
import { hasLocalizedValue, localizedValue, settingBool } from "@/lib/settings";

describe("settings helpers", () => {
  it("resolves localized values with an explicit fallback order", () => {
    const value = { ar: "عربي", en: "English", tr: "Türkçe" };
    expect(localizedValue(value, "ar")).toBe("عربي");
    expect(localizedValue(value, "en")).toBe("English");
    expect(localizedValue(value, "tr")).toBe("Türkçe");
  });

  it("falls back to Arabic then the first non-empty translation", () => {
    expect(localizedValue({ ar: "عربي" }, "tr")).toBe("عربي");
    expect(localizedValue({ en: "English", tr: "Türkçe" }, "ar")).toBe("English");
    expect(localizedValue({ ar: "  ", en: "English" }, "ar")).toBe("English");
  });

  it("handles scalar and missing values", () => {
    expect(localizedValue("plain", "ar")).toBe("plain");
    expect(localizedValue(42, "ar")).toBe("42");
    expect(localizedValue(true, "ar")).toBe("true");
    expect(localizedValue(undefined, "ar")).toBe("");
    expect(localizedValue({}, "ar")).toBe("");
  });

  it("checks whether a requested translation exists", () => {
    expect(hasLocalizedValue({ ar: "نص", en: "" }, "ar")).toBe(true);
    expect(hasLocalizedValue({ ar: "نص", en: "" }, "en")).toBe(false);
    expect(hasLocalizedValue("plain", "ar")).toBe(false);
    expect(hasLocalizedValue(undefined, "ar")).toBe(false);
  });

  it("reads booleans conservatively", () => {
    expect(settingBool({ key: true }, "key")).toBe(true);
    expect(settingBool({ key: "true" }, "key")).toBe(true);
    expect(settingBool({ key: 1 }, "key")).toBe(true);
    expect(settingBool({ key: false }, "key")).toBe(false);
    expect(settingBool({ key: "false" }, "key")).toBe(false);
    expect(settingBool({}, "key")).toBe(false);
  });
});
