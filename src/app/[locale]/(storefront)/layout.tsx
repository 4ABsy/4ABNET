import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { getSettings, localizedValue, settingBool, settingString } from "@/lib/settings";
import { getVisibleCategories } from "@/lib/catalog";
import { createI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ConnectionStatus, PwaRegister } from "@/components/pwa";
import { WifiIcon } from "@/components/icons";

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const [settings, categories] = await Promise.all([getSettings(), getVisibleCategories(locale)]);

  const storeName = settingString(settings, SETTING_KEYS.storeName, locale) || "4AB NET";
  const tagline = settingString(settings, SETTING_KEYS.tagline, locale);
  const logoUrl = settingString(settings, SETTING_KEYS.logoUrl, locale) || "/brand/logo.svg";
  const announcement = localizedValue(settings[SETTING_KEYS.announcement], locale);
  const ordersEnabled = settingBool(settings, SETTING_KEYS.ordersEnabled);
  const maintenance = settingBool(settings, SETTING_KEYS.maintenanceMode);
  const whatsapp = settingString(settings, SETTING_KEYS.whatsapp, locale);
  const email = settingString(settings, SETTING_KEYS.supportEmail, locale);
  const supportHours = settingString(settings, SETTING_KEYS.supportHours, locale);
  const bankTransferEnabled = settingBool(settings, SETTING_KEYS.bankTransferEnabled);
  const about = t("footer.aboutBody");

  return (
    <>
      <PwaRegister />
      <ConnectionStatus />
      <a href="#main-content" className="skip-link">
        {t("common.next")}
      </a>
      {announcement ? (
        <div className="bg-ink px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
          <span className="inline-flex items-center gap-2">
            <WifiIcon size={15} className="text-brand" />
            {announcement}
          </span>
        </div>
      ) : null}

      {maintenance || !ordersEnabled ? (
        <div className="bg-warning-soft px-4 py-2 text-center text-xs font-semibold text-warning">
          {maintenance ? t("admin.settings.maintenanceWarning") : t("admin.settings.ordersPausedWarning")}{" "}
          <Link href={`/${locale}/track`} className="underline underline-offset-4">
            {t("nav.track")}
          </Link>
        </div>
      ) : null}

      <SiteHeader
        logoUrl={logoUrl}
        storeName={storeName}
        tagline={tagline}
        categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      />

      <main id="main-content" className="min-h-[60vh] pb-4">
        {children}
      </main>

      <SiteFooter
        locale={locale}
        storeName={storeName}
        tagline={tagline}
        about={about}
        whatsapp={whatsapp}
        email={email}
        supportHours={supportHours}
        categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
        bankTransferEnabled={bankTransferEnabled}
      />
    </>
  );
}
