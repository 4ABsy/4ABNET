export const LOCALES = ["ar", "en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "4ab_locale";
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  tr: "Türkçe",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Map an Accept-Language header or Telegram language_code to a supported locale. */
export function detectLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const parts = input
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);
  for (const part of parts) {
    const base = part.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  "orders.update",
  "orders.confirm",
  "payments.review",
  "payments.receipts.view",
  "products.manage",
  "categories.manage",
  "banners.manage",
  "coupons.manage",
  "inventory.manage",
  "inventory.deliver",
  "customers.view",
  "content.manage",
  "translations.manage",
  "reports.view",
  "settings.manage",
  "telegram.manage",
  "audit.view",
  "admins.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: { key: string; permissions: Permission[] }[] = [
  { key: "overview", permissions: ["dashboard.view", "reports.view"] },
  {
    key: "orders",
    permissions: ["orders.view", "orders.update", "orders.confirm", "customers.view"],
  },
  {
    key: "payments",
    permissions: ["payments.review", "payments.receipts.view"],
  },
  {
    key: "catalog",
    permissions: [
      "products.manage",
      "categories.manage",
      "banners.manage",
      "coupons.manage",
      "translations.manage",
    ],
  },
  {
    key: "inventory",
    permissions: ["inventory.manage", "inventory.deliver"],
  },
  {
    key: "settings",
    permissions: ["settings.manage", "content.manage", "telegram.manage"],
  },
  { key: "security", permissions: ["audit.view", "admins.manage"] },
];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "AWAITING_CONFIRMATION",
  "AWAITING_PAYMENT",
  "PAYMENT_REVIEW",
  "CONFIRMED",
  "PROCESSING",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "AWAITING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH_ON_DELIVERY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVENTORY_STATUSES = ["AVAILABLE", "RESERVED", "ASSIGNED", "REVOKED"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

/**
 * Permitted order status transitions. Enforcement lives on the server
 * (lib/orders.ts). DELIVERED is only reachable through the delivery workflow.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_REVIEW", "CANCELLED"],
  PAYMENT_REVIEW: ["CONFIRMED", "AWAITING_PAYMENT", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "DELIVERED", "CANCELLED"],
  PROCESSING: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: string, to: string): boolean {
  if (!ORDER_STATUSES.includes(from as OrderStatus)) return false;
  if (!ORDER_STATUSES.includes(to as OrderStatus)) return false;
  return ORDER_TRANSITIONS[from as OrderStatus].includes(to as OrderStatus);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const SETTING_KEYS = {
  storeName: "store.name",
  tagline: "store.tagline",
  logoUrl: "store.logoUrl",
  primaryColor: "store.primaryColor",
  currency: "store.currency",
  announcement: "store.announcement",
  whatsapp: "store.whatsapp",
  supportEmail: "store.supportEmail",
  supportHours: "store.supportHours",
  bankInstructions: "payment.bankInstructions",
  bankAccountName: "payment.bankAccountName",
  bankIban: "payment.bankIban",
  bankName: "payment.bankName",
  bankTransferEnabled: "payment.bankTransfer.enabled",
  codEnabled: "payment.cod.enabled",
  ordersEnabled: "store.ordersEnabled",
  maintenanceMode: "store.maintenanceMode",
  showOffers: "home.showOffers",
  showFeatures: "home.showFeatures",
  showCategories: "home.showCategories",
  showFeatured: "home.showFeatured",
  heroTitle: "home.heroTitle",
  heroSubtitle: "home.heroSubtitle",
  privacyPolicy: "policy.privacy",
  terms: "policy.terms",
  refundPolicy: "policy.refund",
  retentionPolicy: "policy.retention",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const DIGITAL_DELIVERY_NOTE = "digital";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const RESERVATION_HOURS = 48;

export const SESSION_COOKIE = "4ab_admin_session";
export const ORDER_COOKIE = "4ab_order_access";
