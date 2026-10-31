import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CouponForm } from "@/components/admin/coupon-form";
import { AdminFlash } from "@/components/admin/flash";

export const dynamic = "force-dynamic";

export default async function EditCouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "coupons.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  const query = await searchParams;

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />
      <h1 className="text-2xl font-extrabold text-ink">{t("admin.coupons.edit")}</h1>
      <p className="mt-1 text-sm text-muted ltr-value" dir="ltr">{coupon.code}</p>
      <div className="mt-5">
        <CouponForm locale={locale} coupon={coupon} />
      </div>
    </div>
  );
}
