import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner setup",
  robots: { index: false, follow: false },
};

export default async function OwnerSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const owners = await prisma.adminUser.count({ where: { role: "OWNER" } });

  if (owners > 0) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.setup.alreadyDone")}</h1>
        <Link href={`/${locale}/admin/login`} className="btn btn-primary mt-6">
          {t("admin.setup.goToLogin")}
        </Link>
      </div>
    );
  }

  return <SetupForm locale={locale} />;
}
