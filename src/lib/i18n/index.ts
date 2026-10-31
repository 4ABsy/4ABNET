import { ar, type Dictionary } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import { tr } from "./dictionaries/tr";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/constants";
import { formatDate, formatMoney, formatPercent } from "@/lib/money";

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { ar, en, tr };

export function getDictionary(locale: string | undefined): Dictionary {
  const normalized = normalizeLocale(locale);
  const dict = dictionaries[normalized] ?? dictionaries[DEFAULT_LOCALE];
  return dict;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translate(
  dict: Dictionary,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let value = getPath(dict, key);
  if (typeof value !== "string") {
    value = getPath(fallbackDictionary, key);
  }
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

const fallbackDictionary = ar;

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function createI18n(locale: string | undefined) {
  const normalized = normalizeLocale(locale);
  const dict = getDictionary(normalized);
  const t: Translator = (key, vars) => translate(dict, key, vars);
  return {
    locale: normalized,
    dir: normalized === "ar" ? ("rtl" as const) : ("ltr" as const),
    dict,
    t,
    money: (minor: number) => formatMoney(minor, normalized),
    date: (value: Date | string) => formatDate(value, normalized),
    percent: (value: number) => formatPercent(value, normalized),
  };
}
