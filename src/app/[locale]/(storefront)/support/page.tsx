import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getSettings, settingString } from "@/lib/settings";
import { env } from "@/lib/env";
import { HeadsetIcon, TelegramIcon, WhatsAppIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("support.title"), description: t("support.subtitle") };
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const settings = await getSettings();
  const whatsapp = settingString(settings, SETTING_KEYS.whatsapp, locale);
  const email = settingString(settings, SETTING_KEYS.supportEmail, locale);
  const hours = settingString(settings, SETTING_KEYS.supportHours, locale);
  const waDigits = whatsapp.replace(/[^\d]/g, "");
  const hasContact = Boolean(waDigits || email);

  const faqs = [
    ["support.faq1Q", "support.faq1A"],
    ["support.faq2Q", "support.faq2A"],
    ["support.faq3Q", "support.faq3A"],
    ["support.faq4Q", "support.faq4A"],
    ["support.faq5Q", "support.faq5A"],
  ];

  return (
    <div className="container-page mt-8">
      <div className="max-w-2xl">
        <h1 className="section-title">{t("support.title")}</h1>
        <p className="section-subtitle">{t("support.subtitle")}</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <HeadsetIcon size={20} /> {t("support.contactTitle")}
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">{t("support.contactBody")}</p>

            {hasContact ? (
              <ul className="mt-4 space-y-2 text-sm">
                {waDigits ? (
                  <li>
                    <a
                      href={`https://wa.me/${waDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <WhatsAppIcon size={16} /> {t("footer.whatsapp")}:{" "}
                      <bdi className="ltr-value">{whatsapp}</bdi>
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a href={`mailto:${email}`} className="btn btn-secondary btn-sm">
                      {t("footer.email")}: <bdi className="ltr-value">{email}</bdi>
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
                {t("support.notConfiguredBody")}
              </p>
            )}

            {hours ? (
              <div className="mt-5 rounded-xl bg-page p-3">
                <p className="text-xs font-bold text-ink">{t("support.hoursTitle")}</p>
                <p className="mt-1 text-xs text-muted">{hours}</p>
              </div>
            ) : null}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">{t("support.faqTitle")}</h2>
            <dl className="mt-4 space-y-4">
              {faqs.map(([question, answer]) => (
                <div key={question} className="rounded-xl border border-line p-4">
                  <dt className="text-sm font-bold text-ink">{t(question)}</dt>
                  <dd className="mt-1.5 text-xs leading-6 text-muted">{t(answer)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-bold">{t("support.orderHelpTitle")}</h2>
            <p className="mt-2 text-xs leading-6 text-muted">{t("support.orderHelpBody")}</p>
            <Link href={`/${locale}/track`} className="btn btn-primary btn-sm mt-3">
              {t("order.trackOrder")}
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <TelegramIcon size={17} /> {t("telegram.title")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              {env.isTelegramConfigured ? t("telegram.miniAppHint") : t("telegram.botNotConfigured")}
            </p>
            {env.isTelegramConfigured && env.telegramBotUsername ? (
              <a
                href={`https://t.me/${encodeURIComponent(env.telegramBotUsername)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm mt-3"
              >
                <TelegramIcon size={15} /> @{env.telegramBotUsername}
              </a>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-bold">{t("footer.policies")}</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              <li><Link className="hover:text-brand-ink" href={`/${locale}/privacy`}>{t("nav.privacy")}</Link></li>
              <li><Link className="hover:text-brand-ink" href={`/${locale}/terms`}>{t("nav.terms")}</Link></li>
              <li><Link className="hover:text-brand-ink" href={`/${locale}/refund`}>{t("nav.refund")}</Link></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
