"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart, useI18n } from "@/components/providers";
import { EmptyState } from "@/components/empty-state";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { CopyButton } from "@/components/copy-button";

type BankInfo = {
  enabled: boolean;
  name: string;
  accountName: string;
  iban: string;
  instructions: string;
  configured: boolean;
};

export function CheckoutView({
  bank,
  codEnabled,
  ordersEnabled,
}: {
  bank: BankInfo;
  codEnabled: boolean;
  ordersEnabled: boolean;
}) {
  const { locale, t, money } = useI18n();
  const { items, hydrated, totalMinor, clear } = useCart();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"BANK_TRANSFER" | "CASH_ON_DELIVERY">("BANK_TRANSFER");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discountMinor: number;
    totalMinor: number;
  } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponFor, setCouponFor] = useState<string | null>(null);
  const cartSignature = items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join("|");

  useEffect(() => {
    let key = sessionStorage.getItem("4ab_checkout_key");
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem("4ab_checkout_key", key);
    }
    setIdempotencyKey(key);
  }, []);

  // A discount is tied to the cart it was quoted for. If the cart changes while
  // the customer is on checkout, drop the stale quote and ask them to reapply.
  useEffect(() => {
    if (!coupon || couponFor === cartSignature) return;
    setCoupon(null);
    setCouponFor(null);
    setCouponError(t("checkout.couponCartChanged"));
  }, [cartSignature, coupon, couponFor, t]);

  const paymentOptions = useMemo(() => {
    const options: { value: "BANK_TRANSFER" | "CASH_ON_DELIVERY"; enabled: boolean; note?: string }[] = [];
    options.push({ value: "BANK_TRANSFER", enabled: bank.enabled });
    options.push({
      value: "CASH_ON_DELIVERY",
      enabled: codEnabled,
      note: codEnabled ? undefined : t("checkout.codUnavailable"),
    });
    return options;
  }, [bank.enabled, codEnabled, t]);

  if (!hydrated) {
    return <div className="skeleton h-80 w-full" />;
  }

  if (!items.length) {
    return (
      <EmptyState
        title={t("cart.empty")}
        body={t("cart.emptyBody")}
        actionHref={`/${locale}/products`}
        actionLabel={t("common.allProducts")}
      />
    );
  }

  const blocked = !ordersEnabled || (!bank.enabled && !codEnabled) || !idempotencyKey;
  const payableMinor = coupon ? coupon.totalMinor : totalMinor;

  function couponMessage(code: string | undefined, minSubtotalMinor?: number): string {
    const key =
      code === "COUPON_NOT_FOUND"
        ? "checkout.couponErrors.notFound"
        : code === "COUPON_INACTIVE"
          ? "checkout.couponErrors.inactive"
          : code === "COUPON_NOT_STARTED"
            ? "checkout.couponErrors.notStarted"
            : code === "COUPON_EXPIRED"
              ? "checkout.couponErrors.expired"
              : code === "COUPON_EXHAUSTED"
                ? "checkout.couponErrors.exhausted"
                : code === "COUPON_MIN_SUBTOTAL"
                  ? "checkout.couponErrors.minSubtotal"
                  : code === "COUPON_CUSTOMER_LIMIT"
                    ? "checkout.couponErrors.customerLimit"
                    : code === "RATE_LIMITED"
                      ? "checkout.couponErrors.rateLimited"
                      : "checkout.couponErrors.invalid";
    return t(key, { amount: money(minSubtotalMinor ?? 0) });
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          code,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        minSubtotalMinor?: number;
        coupon?: { code: string };
        discountMinor?: number;
        totalMinor?: number;
      };
      if (
        !response.ok ||
        !payload.ok ||
        !payload.coupon ||
        typeof payload.discountMinor !== "number" ||
        typeof payload.totalMinor !== "number"
      ) {
        setCoupon(null);
        setCouponError(couponMessage(payload.code, payload.minSubtotalMinor));
        return;
      }
      setCoupon({
        code: payload.coupon.code,
        discountMinor: payload.discountMinor,
        totalMinor: payload.totalMinor,
      });
      setCouponFor(cartSignature);
      setCouponInput(payload.coupon.code);
    } catch {
      setCoupon(null);
      setCouponError(couponMessage(undefined));
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponFor(null);
    setCouponError(null);
    setCouponInput("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError(t("checkout.validation.nameRequired"));
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError(t("checkout.validation.phoneInvalid"));
      return;
    }
    if (!agreed) {
      setError(t("checkout.agreeRequired"));
      return;
    }
    const selected = paymentOptions.find((option) => option.value === method);
    if (!selected?.enabled) {
      setError(t("checkout.validation.methodInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          name: name.trim(),
          phone: phone.trim(),
          locale,
          paymentMethod: method,
          idempotencyKey,
          couponCode: coupon?.code,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reference?: string;
        code?: string;
        productName?: string;
        minSubtotalMinor?: number;
      };
      if (!response.ok || !payload.reference) {
        switch (payload.code) {
          case "NO_STOCK":
            setError(t("checkout.errors.noStock", { product: payload.productName ?? "" }));
            break;
          case "ORDERS_PAUSED":
            setError(t("checkout.errors.ordersPaused"));
            break;
          case "MAINTENANCE":
            setError(t("checkout.errors.maintenance"));
            break;
          case "METHOD_DISABLED":
            setError(t("checkout.errors.bankDisabled"));
            break;
          case "RATE_LIMITED":
            setError(t("checkout.errors.rateLimited"));
            break;
          case "PRODUCT_UNAVAILABLE":
            setError(t("checkout.errors.productUnavailable"));
            break;
          case "PHONE_INVALID":
          case "NAME_INVALID":
          case "ITEMS_INVALID":
          case "QUANTITY_INVALID":
            setError(t("checkout.errors.invalidData"));
            break;
          default:
            if (payload.code?.startsWith("COUPON_")) {
              setCoupon(null);
              setError(couponMessage(payload.code, payload.minSubtotalMinor));
            } else {
              setError(t("checkout.errors.generic"));
            }
        }
        setSubmitting(false);
        return;
      }
      sessionStorage.removeItem("4ab_checkout_key");
      clear();
      router.push(`/${locale}/orders/${payload.reference}?new=1`);
    } catch {
      setError(t("checkout.errors.generic"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
      <div className="space-y-5">
        {!ordersEnabled ? (
          <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm font-semibold text-warning">
            {t("checkout.errors.ordersPaused")}{" "}
            <Link href={`/${locale}/track`} className="underline underline-offset-4">
              {t("nav.track")}
            </Link>
          </div>
        ) : null}

        <section className="card p-5 sm:p-6" aria-labelledby="checkout-step-1">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-ink">1</span>
            <h2 id="checkout-step-1" className="text-lg font-bold">{t("checkout.step1")}</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customer-name" className="label">{t("checkout.customerName")} *</label>
              <input
                id="customer-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                minLength={2}
                autoComplete="name"
                required
                className="input"
                placeholder={t("checkout.namePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="customer-phone" className="label">{t("checkout.customerPhone")} *</label>
              <input
                id="customer-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={32}
                minLength={7}
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                required
                className="input ltr-value text-start"
                placeholder={t("checkout.phonePlaceholder")}
              />
            </div>
          </div>
          <p className="hint">{t("checkout.phoneHint")}</p>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="checkout-step-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-ink">2</span>
            <h2 id="checkout-step-2" className="text-lg font-bold">{t("checkout.step2")}</h2>
          </div>

          <div className="mt-4 space-y-3">
            {paymentOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  method === option.value && option.enabled
                    ? "border-brand bg-brand-soft/60"
                    : "border-line bg-white"
                } ${!option.enabled ? "cursor-not-allowed opacity-60" : "hover:border-brand/60"}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  checked={method === option.value}
                  disabled={!option.enabled}
                  onChange={() => setMethod(option.value)}
                  className="mt-1 h-4 w-4 accent-[#FA8F40]"
                />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {t(`paymentMethod.${option.value}`)}
                  </span>
                  <span className="mt-0.5 block text-xs leading-6 text-muted">
                    {option.value === "BANK_TRANSFER"
                      ? t("checkout.bankTransferDescription")
                      : option.note ?? t("checkout.cod")}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {method === "BANK_TRANSFER" && bank.enabled ? (
            <div className="mt-4 rounded-2xl border border-line bg-page p-4">
              <h3 className="text-sm font-bold text-ink">{t("checkout.bankDetails")}</h3>
              {bank.configured ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">{t("checkout.bankName")}</dt>
                    <dd className="font-semibold">{bank.name}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">{t("checkout.accountName")}</dt>
                    <dd className="font-semibold">{bank.accountName}</dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-muted">{t("checkout.iban")}</dt>
                    <dd className="flex items-center gap-2">
                      <bdi className="ltr-value rounded-lg bg-white px-2 py-1 text-xs font-bold ring-1 ring-line">{bank.iban}</bdi>
                      <CopyButton value={bank.iban} />
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-2">
                    <dt className="font-bold">{t("checkout.amount")}</dt>
                    <dd className="font-extrabold text-brand-ink">{money(payableMinor)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm font-semibold text-danger">{t("checkout.noBankConfigured")}</p>
              )}
              {bank.instructions ? (
                <p className="mt-3 text-xs leading-6 text-ink-soft">{bank.instructions}</p>
              ) : null}
              <p className="mt-3 text-xs leading-6 text-muted">{t("checkout.paymentPendingNote")}</p>
            </div>
          ) : null}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="checkout-step-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-ink">3</span>
            <h2 id="checkout-step-3" className="text-lg font-bold">{t("checkout.step3")}</h2>
          </div>

          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-page px-3 py-2 text-sm">
                <span className="font-semibold">
                  {item.name} <span className="text-muted">× {item.quantity}</span>
                </span>
                <span className="font-bold">{money(item.priceMinor * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-line p-3 text-xs leading-6 text-ink-soft">
            <p><span className="font-bold">{t("checkout.customerName")}:</span> {name || "—"}</p>
            <p><span className="font-bold">{t("checkout.customerPhone")}:</span> <bdi className="ltr-value">{phone || "—"}</bdi></p>
            <p><span className="font-bold">{t("checkout.paymentMethod")}:</span> {t(`paymentMethod.${method}`)}</p>
          </div>

          <label className="mt-4 flex items-start gap-2 text-xs leading-6 text-ink-soft">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#FA8F40]"
              required
            />
            <span>
              {t("checkout.agree")}{" "}
              <Link href={`/${locale}/terms`} className="link" target="_blank">{t("nav.terms")}</Link>
              {" · "}
              <Link href={`/${locale}/refund`} className="link" target="_blank">{t("nav.refund")}</Link>
            </span>
          </label>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <ShieldIcon size={15} className="text-success" />
            {t("checkout.reviewNote")}
          </p>
        </section>
      </div>

      <aside className="card sticky top-24 p-5">
        <h2 className="text-lg font-bold">{t("order.summary")}</h2>

        <div className="mt-4 rounded-xl border border-line bg-page p-3">
          <label htmlFor="coupon-code" className="label">{t("checkout.coupon")}</label>
          {coupon ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="badge badge-success ltr-value" dir="ltr">
                {coupon.code}
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                className="btn btn-ghost btn-sm"
              >
                {t("checkout.removeCoupon")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                id="coupon-code"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                maxLength={32}
                dir="ltr"
                autoComplete="off"
                className="input ltr-value"
                placeholder={t("checkout.couponPlaceholder")}
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponBusy || !couponInput.trim()}
                className="btn btn-secondary btn-sm shrink-0"
              >
                {couponBusy ? t("checkout.couponChecking") : t("checkout.applyCoupon")}
              </button>
            </div>
          )}
          {coupon ? (
            <p className="mt-2 text-xs font-semibold text-success">
              {t("checkout.couponApplied", { code: coupon.code })}
            </p>
          ) : null}
          {couponError ? (
            <p role="alert" className="mt-2 text-xs font-semibold text-danger">
              {couponError}
            </p>
          ) : null}
          {!coupon && !couponError ? (
            <p className="hint">{t("checkout.couponHint")}</p>
          ) : null}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("common.subtotal")}</dt>
            <dd className="font-semibold">{money(totalMinor)}</dd>
          </div>
          {coupon ? (
            <div className="flex justify-between">
              <dt className="text-muted">
                {t("checkout.couponDiscount", { code: coupon.code })}
              </dt>
              <dd className="font-semibold text-success">-{money(coupon.discountMinor)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">{t("common.quantity")}</dt>
            <dd className="font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base">
            <dt className="font-bold">{t("common.total")}</dt>
            <dd className="font-extrabold text-brand-ink">{money(payableMinor)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-muted">{t("cart.digitalNote")}</p>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold leading-6 text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || blocked}
          className="btn btn-primary mt-4 h-12 w-full"
        >
          {submitting ? t("checkout.placing") : t("checkout.placeOrder")}
        </button>

        {!bank.enabled && !codEnabled ? (
          <p className="mt-3 text-xs font-semibold text-danger">{t("checkout.errors.bankDisabled")}</p>
        ) : null}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <CheckIcon size={14} className="text-success" /> {t("order.secureNote")}
        </p>
      </aside>
    </form>
  );
}
