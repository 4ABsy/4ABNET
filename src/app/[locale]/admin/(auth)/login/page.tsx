import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);

  const session = await getAdminSession();
  if (session) redirect(`/${locale}/admin`);

  const owners = await prisma.adminUser.count({ where: { role: "OWNER" } });

  if (owners === 0) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.login.setupTitle")}</h1>
        <p className="mt-2 text-sm leading-7 text-muted">{t("admin.login.setupBody")}</p>
        <Link href={`/${locale}/admin/setup`} className="btn btn-primary mt-6">
          {t("admin.login.setupCta")}
        </Link>
        <p className="mt-4 text-xs text-muted">
          <Link href={`/${locale}`} className="link">
            {t("admin.login.backToStore")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoginForm locale={locale} />
      <p className="text-center text-xs text-muted">
        <Link href={`/${locale}/admin/telegram-login`} className="link">
          {t("telegram.adminLoginTitle")}
        </Link>
      </p>
    </div>
  );
}
