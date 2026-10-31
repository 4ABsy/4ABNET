import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { env } from "@/lib/env";
import { TrackForm } from "@/components/track-form";
import { TelegramLinkCard } from "@/components/telegram-link";
import { HeadsetIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("order.trackingTitle"), description: t("order.trackingSubtitle") };
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const query = await searchParams;
  const reference = typeof query.reference === "string" ? query.reference.slice(0, 32).toUpperCase() : "";
  const telegramConfigured = env.isTelegramConfigured;

  return (
    <div className="container-page mt-8">
      <div className="max-w-2xl">
        <h1 className="section-title">{t("order.trackingTitle")}</h1>
        <p className="section-subtitle">{t("order.trackingSubtitle")}</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <div className="space-y-5">
          <TrackForm reference={reference} />

          <TelegramLinkCard
            reference={reference}
            configured={telegramConfigured}
            botUsername={env.telegramBotUsername}
          />

          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ShieldIcon size={18} /> {t("order.secureNote")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">{t("order.saveLink")}</p>
            <p className="mt-2 text-xs leading-6 text-muted">{t("order.notFoundBody")}</p>
            <Link href={`/${locale}/support`} className="btn btn-ghost btn-sm mt-2">
              <HeadsetIcon size={15} /> {t("order.contactSupport")}
            </Link>
          </section>
        </div>

        <aside className="card p-5">
          <h2 className="text-sm font-bold">{t("support.faqTitle")}</h2>
          <dl className="mt-3 space-y-4 text-xs leading-6 text-muted">
            <div>
              <dt className="font-bold text-ink">{t("support.faq1Q")}</dt>
              <dd className="mt-1">{t("support.faq1A")}</dd>
            </div>
            <div>
              <dt className="font-bold text-ink">{t("support.faq3Q")}</dt>
              <dd className="mt-1">{t("support.faq3A")}</dd>
            </div>
            <div>
              <dt className="font-bold text-ink">{t("support.faq5Q")}</dt>
              <dd className="mt-1">{t("support.faq5A")}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
