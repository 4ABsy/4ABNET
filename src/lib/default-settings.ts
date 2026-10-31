import { SETTING_KEYS } from "./constants";

export type SettingValue = string | number | boolean | null | Record<string, string>;

export type StoreSettings = Record<string, SettingValue>;

/**
 * Localized brand defaults. The announcement bar keeps the required Arabic
 * default and includes the English and Turkish versions the brief asks for.
 *
 * This module is safe to import from scripts and tests: it has no runtime
 * dependency on the database or the `server-only` package.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  [SETTING_KEYS.storeName]: "4AB NET",
  [SETTING_KEYS.tagline]: {
    ar: "إنترنت بضغطة زر",
    en: "Internet at the click of a button",
    tr: "Tek tıkla internet",
  },
  [SETTING_KEYS.logoUrl]: "/brand/logo.svg",
  [SETTING_KEYS.primaryColor]: "#FA8F40",
  [SETTING_KEYS.currency]: "TRY",
  [SETTING_KEYS.announcement]: {
    ar: "ابقى على تواصل مع من تحب بدون انقطاع",
    en: "Stay connected with the people you love, without interruption",
    tr: "Sevdiklerinizle kesintisiz bağlantıda kalın",
  },
  [SETTING_KEYS.heroTitle]: {
    ar: "اتصل بالعالم بكل سهولة",
    en: "Stay connected, anywhere",
    tr: "Her yerde bağlantıda kalın",
  },
  [SETTING_KEYS.heroSubtitle]: {
    ar: "باقات eSIM رقمية تُسلَّم فوراً، بأسعار واضحة ودعم بالعربية والتركية والإنجليزية.",
    en: "Digital eSIM packages delivered securely, with clear pricing and support in Arabic, English, and Turkish.",
    tr: "Güvenli teslim edilen dijital eSIM paketleri, net fiyatlar ve Arapça, İngilizce, Türkçe destek.",
  },
  [SETTING_KEYS.whatsapp]: "",
  [SETTING_KEYS.supportEmail]: "",
  [SETTING_KEYS.supportHours]: {
    ar: "كل يوم 09:00 - 21:00 (بتوقيت تركيا)",
    en: "Every day 09:00 - 21:00 (Türkiye time)",
    tr: "Her gün 09:00 - 21:00 (Türkiye saati)",
  },
  [SETTING_KEYS.bankInstructions]: {
    ar: "حوّل المبلغ الإجمالي إلى الحساب البنكي أدناه، ثم ارفع صورة إيصال التحويل. يبقى الدفع قيد المراجعة حتى يتحقق فريقنا منه.",
    en: "Transfer the total amount to the bank account below, then upload the transfer receipt. Payment stays under review until our team verifies it.",
    tr: "Toplam tutarı aşağıdaki banka hesabına aktarın ve havale makbuzunu yükleyin. Ödeme ekibimiz doğrulayana kadar inceleme altında kalır.",
  },
  [SETTING_KEYS.bankAccountName]: "4AB NET DEMO ACCOUNT — replace in settings",
  [SETTING_KEYS.bankIban]: "TR00 0000 0000 0000 0000 0000 00",
  [SETTING_KEYS.bankName]: "DEMO BANK — replace in settings",
  [SETTING_KEYS.bankTransferEnabled]: true,
  [SETTING_KEYS.codEnabled]: false,
  [SETTING_KEYS.ordersEnabled]: true,
  [SETTING_KEYS.maintenanceMode]: false,
  [SETTING_KEYS.showOffers]: true,
  [SETTING_KEYS.showFeatures]: true,
  [SETTING_KEYS.showCategories]: true,
  [SETTING_KEYS.showFeatured]: true,
  [SETTING_KEYS.privacyPolicy]: "",
  [SETTING_KEYS.terms]: "",
  [SETTING_KEYS.refundPolicy]: "",
  [SETTING_KEYS.retentionPolicy]: "",
};
