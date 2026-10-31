import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getSettings, settingBool, settingString } from "@/lib/settings";
import { CheckoutView } from "@/components/checkout-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("checkout.title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const settings = await getSettings();

  const bank = {
    enabled: settingBool(settings, SETTING_KEYS.bankTransferEnabled),
    name: settingString(settings, SETTING_KEYS.bankName, locale),
    accountName: settingString(settings, SETTING_KEYS.bankAccountName, locale),
    iban: settingString(settings, SETTING_KEYS.bankIban, locale),
    instructions: settingString(settings, SETTING_KEYS.bankInstructions, locale),
    configured: false,
  };
  bank.configured = Boolean(bank.iban.replace(/\s/g, "").length >= 10 && bank.accountName.trim());

  const codEnabled = settingBool(settings, SETTING_KEYS.codEnabled);
  const ordersEnabled =
    settingBool(settings, SETTING_KEYS.ordersEnabled) && !settingBool(settings, SETTING_KEYS.maintenanceMode);

  return (
    <div className="container-page mt-8">
      <h1 className="section-title">{t("checkout.title")}</h1>
      <p className="section-subtitle">{t("checkout.subtitle")}</p>
      <div className="mt-6">
        <CheckoutView bank={bank} codEnabled={codEnabled} ordersEnabled={ordersEnabled} />
      </div>
    </div>
  );
}
