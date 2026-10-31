import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { TelegramLoginForm } from "./telegram-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telegram admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminTelegramLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);

  const session = await getAdminSession();
  if (session) redirect(`/${locale}/admin`);

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-ink">{t("telegram.adminLoginTitle")}</h1>
      <p className="mt-2 text-sm leading-7 text-muted">{t("telegram.adminLoginBody")}</p>
      <TelegramLoginForm
        locale={locale}
        configured={env.isTelegramConfigured}
        botUsername={env.telegramBotUsername}
      />
    </div>
  );
}
