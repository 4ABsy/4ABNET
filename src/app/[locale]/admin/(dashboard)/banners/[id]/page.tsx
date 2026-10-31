import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BannerForm } from "@/components/admin/banner-form";

export const dynamic = "force-dynamic";

export default async function AdminEditBannerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "banners.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const banner = await prisma.banner.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!banner) notFound();

  return (
    <div>
      <Link href={`/${locale}/admin/banners`} className="link text-xs font-semibold">
        ← {t("admin.banners.title")}
      </Link>
      <h1 className="mt-1 mb-5 text-2xl font-extrabold text-ink">{t("admin.banners.edit")}</h1>
      <BannerForm locale={locale} banner={banner} />
    </div>
  );
}
