import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function AdminAuthLayout({
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

  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-line bg-white">
        <div className="container-page flex items-center justify-between gap-4 py-4">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-ink">
              4AB
            </span>
            <span>
              <span className="block text-base font-extrabold leading-tight text-ink">4AB NET</span>
              <span className="block text-[11px] font-semibold text-muted">{t("admin.dashboard")}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/${locale}`} className="btn btn-ghost btn-sm">
              {t("admin.login.backToStore")}
            </Link>
            <LanguageSwitcher compact />
          </div>
        </div>
      </header>
      <main className="container-page flex justify-center py-10 sm:py-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
