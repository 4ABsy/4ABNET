import Link from "next/link";
import type { Coupon } from "@prisma/client";
import type { Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { saveCouponAction } from "@/app/[locale]/admin/actions";

/** Format a date for <input type="datetime-local"> in the store timezone. */
function toInputValue(date: Date | null): string {
  if (!date) return "";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function CouponForm({ locale, coupon }: { locale: Locale; coupon: Coupon | null }) {
  const { t } = createI18n(locale);
  const value = coupon
    ? coupon.type === "PERCENT"
      ? String((coupon.percentBasisPoints ?? 0) / 100)
      : ((coupon.amountMinor ?? 0) / 100).toFixed(2)
    : "";

  return (
    <form action={saveCouponAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={coupon?.id ?? ""} />
      <input type="hidden" name="returnTo" value={`/${locale}/admin/coupons`} />

      <section className="card p-5">
        <h2 className="text-lg font-bold">{t("admin.coupons.details")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="coupon-code" className="label">{t("admin.coupons.code")}</label>
            <input
              id="coupon-code"
              name="code"
              defaultValue={coupon?.code ?? ""}
              required
              dir="ltr"
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
              className="input ltr-value"
              placeholder="WELCOME10"
              autoComplete="off"
            />
            <p className="hint">{t("admin.coupons.codeHint")}</p>
          </div>
          <div>
            <label htmlFor="coupon-type" className="label">{t("admin.coupons.type")}</label>
            <select
              id="coupon-type"
              name="type"
              defaultValue={coupon?.type ?? "PERCENT"}
              className="input"
            >
              <option value="PERCENT">{t("admin.coupons.percent")}</option>
              <option value="FIXED">{t("admin.coupons.fixed")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="coupon-value" className="label">{t("admin.coupons.value")}</label>
            <input
              id="coupon-value"
              name="value"
              defaultValue={value}
              required
              inputMode="decimal"
              dir="ltr"
              maxLength={12}
              className="input ltr-value"
              placeholder="10"
            />
            <p className="hint">{t("admin.coupons.valueHint")}</p>
          </div>
          <div>
            <label htmlFor="coupon-min" className="label">{t("admin.coupons.minSubtotal")}</label>
            <input
              id="coupon-min"
              name="minSubtotal"
              defaultValue={
                coupon && coupon.minSubtotalMinor > 0
                  ? (coupon.minSubtotalMinor / 100).toFixed(2)
                  : ""
              }
              inputMode="decimal"
              dir="ltr"
              maxLength={12}
              className="input ltr-value"
              placeholder="0.00"
            />
            <p className="hint">{t("admin.coupons.minSubtotalHint")}</p>
          </div>
          <div>
            <label htmlFor="coupon-max" className="label">{t("admin.coupons.maxDiscount")}</label>
            <input
              id="coupon-max"
              name="maxDiscount"
              defaultValue={
                coupon?.maxDiscountMinor ? (coupon.maxDiscountMinor / 100).toFixed(2) : ""
              }
              inputMode="decimal"
              dir="ltr"
              maxLength={12}
              className="input ltr-value"
              placeholder=""
            />
            <p className="hint">{t("admin.coupons.maxDiscountHint")}</p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">{t("admin.coupons.limits")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="coupon-usage" className="label">{t("admin.coupons.usageLimit")}</label>
            <input
              id="coupon-usage"
              name="usageLimit"
              type="number"
              min={1}
              max={1000000}
              step={1}
              defaultValue={coupon?.usageLimit ?? ""}
              dir="ltr"
              className="input ltr-value"
              placeholder="∞"
            />
            <p className="hint">{t("admin.coupons.usageLimitHint")}</p>
          </div>
          <div>
            <label htmlFor="coupon-per-customer" className="label">
              {t("admin.coupons.perCustomerLimit")}
            </label>
            <input
              id="coupon-per-customer"
              name="perCustomerLimit"
              type="number"
              min={1}
              max={1000}
              step={1}
              defaultValue={coupon?.perCustomerLimit ?? ""}
              dir="ltr"
              className="input ltr-value"
              placeholder="1"
            />
            <p className="hint">{t("admin.coupons.perCustomerLimitHint")}</p>
          </div>
          <div>
            <label htmlFor="coupon-starts" className="label">{t("admin.coupons.startsAt")}</label>
            <input
              id="coupon-starts"
              name="startsAt"
              type="datetime-local"
              defaultValue={toInputValue(coupon?.startsAt ?? null)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="coupon-expires" className="label">{t("admin.coupons.expiresAt")}</label>
            <input
              id="coupon-expires"
              name="expiresAt"
              type="datetime-local"
              defaultValue={toInputValue(coupon?.expiresAt ?? null)}
              className="input"
            />
            <p className="hint">{t("admin.coupons.scheduleHint")}</p>
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={coupon ? coupon.isActive : true}
            className="h-4 w-4 accent-[#FA8F40]"
          />
          {t("admin.coupons.active")}
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary">
          {coupon ? t("admin.coupons.save") : t("admin.coupons.create")}
        </button>
        <Link href={`/${locale}/admin/coupons`} className="btn btn-ghost">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
