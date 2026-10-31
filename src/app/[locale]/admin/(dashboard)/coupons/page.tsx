import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { textContains } from "@/lib/db-search";
import { couponState, type CouponState } from "@/lib/coupon-rules";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import {
  deleteCouponAction,
  toggleCouponAction,
} from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  state?: string;
  ok?: string;
  error?: string;
};

const STATE_BADGE: Record<CouponState, string> = {
  ACTIVE: "badge badge-success",
  SCHEDULED: "badge badge-brand",
  EXPIRED: "badge badge-neutral",
  DISABLED: "badge badge-warning",
  EXHAUSTED: "badge badge-danger",
};

const STATE_LABEL: Record<CouponState, string> = {
  ACTIVE: "admin.coupons.stateActive",
  SCHEDULED: "admin.coupons.stateScheduled",
  EXPIRED: "admin.coupons.stateExpired",
  DISABLED: "admin.coupons.stateDisabled",
  EXHAUSTED: "admin.coupons.stateExhausted",
};

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminCouponsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "coupons.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const q = single(query.q).trim();
  const state = single(query.state);
  const now = new Date();

  const where: Prisma.CouponWhereInput = {};
  if (q) where.code = textContains(q.toUpperCase());
  if (state === "active") {
    where.isActive = true;
    where.AND = [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ];
  } else if (state === "scheduled") {
    where.startsAt = { gt: now };
  } else if (state === "expired") {
    where.expiresAt = { lte: now };
  } else if (state === "disabled") {
    where.isActive = false;
  }

  const coupons = await prisma.coupon.findMany({
    where,
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const numberFormat = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
    maximumFractionDigits: 2,
  });
  const valueLabel = (coupon: (typeof coupons)[number]) =>
    coupon.type === "PERCENT"
      ? `${numberFormat.format((coupon.percentBasisPoints ?? 0) / 100)}%`
      : money(coupon.amountMinor ?? 0);

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.coupons.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.coupons.subtitle")}</p>
        </div>
        <Link href={`/${locale}/admin/coupons/new`} className="btn btn-primary btn-sm">
          + {t("admin.coupons.add")}
        </Link>
      </div>

      <form method="get" className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="coupon-q" className="label">{t("common.search")}</label>
          <input
            id="coupon-q"
            name="q"
            defaultValue={q}
            placeholder={t("admin.coupons.searchPlaceholder")}
            className="input ltr-value"
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="coupon-state" className="label">{t("admin.coupons.filterState")}</label>
          <select id="coupon-state" name="state" defaultValue={state} className="input">
            <option value="">{t("common.all")}</option>
            <option value="active">{t("admin.coupons.stateActive")}</option>
            <option value="scheduled">{t("admin.coupons.stateScheduled")}</option>
            <option value="expired">{t("admin.coupons.stateExpired")}</option>
            <option value="disabled">{t("admin.coupons.stateDisabled")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-secondary btn-sm">{t("common.filter")}</button>
          <Link href={`/${locale}/admin/coupons`} className="btn btn-ghost btn-sm">{t("common.reset")}</Link>
        </div>
      </form>

      {coupons.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.coupons.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.coupons.code")}</th>
                <th>{t("admin.coupons.value")}</th>
                <th>{t("admin.coupons.usage")}</th>
                <th>{t("admin.coupons.validity")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const current = couponState(coupon, now);
                const validity =
                  [
                    coupon.startsAt ? date(coupon.startsAt) : null,
                    coupon.expiresAt ? date(coupon.expiresAt) : null,
                  ]
                    .filter(Boolean)
                    .join(" → ") || t("admin.coupons.always");

                return (
                  <tr key={coupon.id}>
                    <td>
                      <p className="font-extrabold ltr-value" dir="ltr">{coupon.code}</p>
                      <p className="text-[11px] text-muted">
                        {coupon.type === "PERCENT"
                          ? t("admin.coupons.percent")
                          : t("admin.coupons.fixed")}
                        {coupon.minSubtotalMinor > 0
                          ? ` · ${t("admin.coupons.minShort", { amount: money(coupon.minSubtotalMinor) })}`
                          : ""}
                      </p>
                    </td>
                    <td className="font-bold">{valueLabel(coupon)}</td>
                    <td>
                      <span className="font-semibold">
                        {t("admin.coupons.usageCount", {
                          used: coupon.usedCount,
                          limit: coupon.usageLimit ?? "∞",
                        })}
                      </span>
                      {coupon.perCustomerLimit !== null ? (
                        <p className="text-[11px] text-muted">
                          {t("admin.coupons.perCustomerShort", {
                            count: coupon.perCustomerLimit,
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-xs">{validity}</td>
                    <td>
                      <span className={STATE_BADGE[current]}>{t(STATE_LABEL[current])}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/${locale}/admin/coupons/${coupon.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          {t("common.edit")}
                        </Link>
                        <form action={toggleCouponAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={coupon.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/coupons`} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            {coupon.isActive
                              ? t("admin.coupons.disable")
                              : t("admin.coupons.enable")}
                          </button>
                        </form>
                        {coupon._count.orders === 0 ? (
                          <ConfirmForm
                            action={deleteCouponAction}
                            message={t("admin.coupons.deleteConfirm")}
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={coupon.id} />
                            <input type="hidden" name="returnTo" value={`/${locale}/admin/coupons`} />
                            <button type="submit" className="btn btn-danger btn-sm">
                              {t("common.delete")}
                            </button>
                          </ConfirmForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
