import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { CouponForm } from "@/components/admin/coupon-form";

export const dynamic = "force-dynamic";

export default async function NewCouponPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
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

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">{t("admin.coupons.add")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.coupons.subtitle")}</p>
      <div className="mt-5">
        <CouponForm locale={locale} coupon={null} />
      </div>
    </div>
  );
}
