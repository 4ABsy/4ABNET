import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getSettings, settingString } from "@/lib/settings";
import { LegalDocument } from "@/components/legal-document";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("legal.refundTitle"), description: t("footer.aboutBody") };
}

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, dict } = createI18n(locale);
  const settings = await getSettings();

  return (
    <LegalDocument
      locale={locale}
      title={t("legal.refundTitle")}
      override={settingString(settings, SETTING_KEYS.refundPolicy, locale)}
      fallback={dict.legal.refundBody}
    />
  );
}
