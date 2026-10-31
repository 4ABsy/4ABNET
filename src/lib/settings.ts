import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { cachedRead } from "@/lib/store-cache";
import { SETTING_KEYS, type Locale } from "@/lib/constants";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";

export type SettingValue = string | number | boolean | null | Record<string, string>;

export type StoreSettings = Record<string, SettingValue>;

export { DEFAULT_SETTINGS };

async function loadSettings(): Promise<StoreSettings> {
  const rows = await prisma.storeSetting.findMany();
  const values: StoreSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      values[row.key] = JSON.parse(row.value) as SettingValue;
    } catch {
      values[row.key] = row.value;
    }
  }
  return values;
}

/**
 * Settings are read by every layout and page. React's cache deduplicates the
 * query within a single request, and `cachedRead` keeps it for a minute across
 * requests so a warm server instance renders without touching the database.
 */
export const getSettings = cache(
  async (): Promise<StoreSettings> => cachedRead("store:settings", loadSettings),
);

export async function getSetting(key: string): Promise<SettingValue | undefined> {
  const row = await prisma.storeSetting.findUnique({ where: { key } });
  if (!row) return DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(row.value) as SettingValue;
  } catch {
    return row.value;
  }
}

export async function setSetting(key: string, value: SettingValue): Promise<void> {
  await prisma.storeSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

/** Resolve a localized setting with ar → en → tr → first available fallback. */
export function localizedValue(value: SettingValue | undefined, locale: Locale): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const order: Locale[] = [locale, "ar", "en", "tr"];
  for (const key of order) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  const first = Object.values(value).find((v) => typeof v === "string" && v.trim());
  return typeof first === "string" ? first : "";
}

/** True when a localized setting has the requested language filled in. */
export function hasLocalizedValue(value: SettingValue | undefined, locale: Locale): boolean {
  return Boolean(value && typeof value === "object" && typeof value[locale] === "string" && value[locale].trim());
}

export function settingString(settings: StoreSettings, key: string, locale: Locale): string {
  return localizedValue(settings[key], locale);
}

export function settingBool(settings: StoreSettings, key: string): boolean {
  const value = settings[key];
  return value === true || value === "true" || value === 1;
}
