import Link from "next/link";
import { createI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/site-header";
import { InstallAppButton } from "@/components/pwa";
import type { Locale } from "@/lib/constants";

export function SiteFooter({
  locale,
  storeName,
  tagline,
  about,
  whatsapp,
  email,
  supportHours,
  categories,
  bankTransferEnabled,
}: {
  locale: Locale;
  storeName: string;
  tagline: string;
  about: string;
  whatsapp: string;
  email: string;
  supportHours: string;
  categories: { slug: string; name: string }[];
  bankTransferEnabled: boolean;
}) {
  const { t } = createI18n(locale);
  const waDigits = whatsapp.replace(/[^\d]/g, "");

  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-ink">
              4AB
            </span>
            <div>
              <p className="text-lg font-extrabold text-ink">{storeName}</p>
              <p className="text-xs font-medium text-muted">{tagline}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">{about}</p>
          <div className="mt-4">
            <InstallAppButton />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">{t("footer.quickLinks")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-brand-ink" href={`/${locale}/products`}>{t("nav.products")}</Link></li>
            <li><Link className="hover:text-brand-ink" href={`/${locale}/track`}>{t("nav.track")}</Link></li>
            <li><Link className="hover:text-brand-ink" href={`/${locale}/support`}>{t("nav.support")}</Link></li>
            <li><Link className="hover:text-brand-ink" href={`/${locale}/privacy`}>{t("nav.privacy")}</Link></li>
            <li><Link className="hover:text-brand-ink" href={`/${locale}/terms`}>{t("nav.terms")}</Link></li>
            <li><Link className="hover:text-brand-ink" href={`/${locale}/refund`}>{t("nav.refund")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">{t("footer.categories")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {categories.slice(0, 6).map((category) => (
              <li key={category.slug}>
                <Link className="hover:text-brand-ink" href={`/${locale}/categories/${category.slug}`}>
                  {category.name}
                </Link>
              </li>
            ))}
            {categories.length === 0 ? <li>{t("common.noResults")}</li> : null}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">{t("footer.support")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {waDigits ? (
              <li>
                <a
                  className="inline-flex items-center gap-2 hover:text-brand-ink"
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("footer.whatsapp")}: <bdi className="ltr-value">{whatsapp}</bdi>
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-brand-ink" href={`mailto:${email}`}>
                  {t("footer.email")}: <bdi className="ltr-value">{email}</bdi>
                </a>
              </li>
            ) : null}
            {supportHours ? <li>{t("footer.hours")}: {supportHours}</li> : null}
            {!waDigits && !email ? <li>{t("common.notConfigured")}</li> : null}
          </ul>

          <h2 className="mt-5 text-sm font-bold text-ink">{t("footer.payments")}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {bankTransferEnabled ? <li>{t("footer.bankTransfer")}</li> : null}
            <li className="text-xs">{t("order.currencyNote")}</li>
          </ul>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} {storeName}. {t("footer.rights")}</p>
          <div className="flex items-center gap-4">
            <Link className="hover:text-brand-ink" href={`/${locale}/admin/login`}>
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
