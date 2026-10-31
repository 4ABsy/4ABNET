import type { Locale } from "@/lib/constants";

/** Format an amount stored in minor units (kuruş) as Turkish Lira. */
export function formatMoney(minor: number, locale: Locale = "ar"): string {
  const value = minor / 100;
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string, locale: Locale = "ar"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(d);
}

export function formatPercent(value: number, locale: Locale = "ar"): string {
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.NumberFormat(intlLocale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Safe money arithmetic: all totals are integer minor units. */
export function lineTotal(unitPriceMinor: number, quantity: number): number {
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new Error("Invalid unit price");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Invalid quantity");
  }
  return unitPriceMinor * quantity;
}

export function discountPercent(priceMinor: number, originalMinor: number | null | undefined): number {
  if (!originalMinor || originalMinor <= priceMinor) return 0;
  return Math.round(((originalMinor - priceMinor) / originalMinor) * 100);
}
