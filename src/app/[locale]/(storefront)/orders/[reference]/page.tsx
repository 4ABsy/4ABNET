import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { hasOrderAccess } from "@/lib/order-access";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { getCustomerOrder, deliveredUnits, orderStatusMessageKey } from "@/lib/order-view";
import { StatusBadge } from "@/components/status-badge";
import { ReceiptUpload } from "@/components/receipt-upload";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { TelegramLinkCard } from "@/components/telegram-link";
import { env } from "@/lib/env";
import { CheckIcon, DownloadIcon, QrIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; reference: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("order.detailsTitle"), robots: { index: false, follow: false } };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; reference: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale: rawLocale, reference } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const query = await searchParams;

  const allowedByCookie = await hasOrderAccess(reference);
  let allowed = allowedByCookie;
  if (!allowed) {
    const admin = await getAdminSession();
    allowed = hasPermission(admin, "orders.view");
  }

  if (!allowed) {
    return (
      <div className="container-page mt-10 max-w-2xl">
        <EmptyState
          title={t("order.notFound")}
          body={t("order.notFoundBody")}
          actionHref={`/${locale}/track`}
          actionLabel={t("order.trackOrder")}
          icon={<ShieldIcon size={26} />}
        />
      </div>
    );
  }

  const order = await getCustomerOrder(reference);
  if (!order) notFound();

  const units = deliveredUnits(order);
  const showReceiptUpload =
    order.paymentMethod === "BANK_TRANSFER" &&
    ["AWAITING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="container-page mt-8">
      {query.new === "1" ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-success/20 bg-success-soft p-4">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-success text-white">
            <CheckIcon size={16} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-success">{t("order.confirmationTitle")}</h2>
            <p className="mt-1 text-xs leading-6 text-success/90">{t("order.confirmationBody")}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{t("order.reference")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-wide text-ink sm:text-3xl" dir="ltr">
              {order.reference}
            </h1>
            <CopyButton value={order.reference} />
          </div>
          <p className="mt-2 text-xs text-muted">{t("order.date")}: {date(order.createdAt)}</p>
          {order.couponCode ? (
            <p className="mt-1 text-xs text-muted">
              {t("order.coupon")}: <span className="font-bold text-ink ltr-value" dir="ltr">{order.couponCode}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="order" status={order.status} label={t(`status.${order.status}`)} />
          <StatusBadge kind="payment" status={order.paymentStatus} label={t(`paymentStatus.${order.paymentStatus}`)} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">{t("order.detailsTitle")}</h2>
            <p className="mt-2 rounded-xl bg-brand-soft p-3 text-xs leading-6 text-brand-ink">
              {t(orderStatusMessageKey(order.status))}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 text-start font-bold">{t("order.items")}</th>
                    <th className="py-2 text-center font-bold">{t("common.quantity")}</th>
                    <th className="py-2 text-end font-bold">{t("common.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t border-line">
                      <td className="py-3">
                        <p className="font-semibold text-ink">{item.productName}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {[item.dataAllowance, item.validityDays ? t("product.validityDays", { days: item.validityDays }) : null]
                            .filter(Boolean)
                            .join(" · ") || t("common.notProvided")}
                        </p>
                      </td>
                      <td className="py-3 text-center font-semibold">{item.quantity}</td>
                      <td className="py-3 text-end font-bold">{money(item.lineTotalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.subtotal")}</dt>
                <dd className="font-semibold">{money(order.subtotalMinor)}</dd>
              </div>
              {order.discountMinor > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {order.couponCode
                      ? t("checkout.couponDiscount", { code: order.couponCode })
                      : t("common.discount")}
                  </dt>
                  <dd className="font-semibold text-success">-{money(order.discountMinor)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-bold">{t("common.total")}</dt>
                <dd className="font-extrabold text-brand-ink">{money(order.totalMinor)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-muted">{t("order.currencyNote")}</p>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">{t("order.payment")}</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{t("order.paymentMethod")}</dt>
                <dd className="font-semibold">{t(`paymentMethod.${order.paymentMethod}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("order.paymentStatus")}</dt>
                <dd><StatusBadge kind="payment" status={order.paymentStatus} label={t(`paymentStatus.${order.paymentStatus}`)} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("checkout.amount")}</dt>
                <dd className="font-semibold">{money(order.totalMinor)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("order.receipt")}</dt>
                <dd className="font-semibold">
                  {order.receipts.length ? t("order.receiptUploaded") : t("order.receiptPending")}
                </dd>
              </div>
            </dl>
            {order.payment?.reviewNote && order.payment.status === "REJECTED" ? (
              <p className="mt-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">{order.payment.reviewNote}</p>
            ) : null}
            {showReceiptUpload ? <ReceiptUpload reference={order.reference} /> : null}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold">{t("order.deliveryTitle")}</h2>
            {units.length === 0 ? (
              <p className="mt-2 text-sm leading-7 text-muted">{t("order.deliveryPending")}</p>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">
                  <CheckIcon size={16} /> {t("order.deliveryReady")}
                </p>
                {units.map((unit, index) => (
                  <div key={unit.id} className="rounded-2xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">
                        {t("admin.orders.unit")} {index + 1}
                      </h3>
                      {unit.deliveredAt ? (
                        <span className="text-[11px] text-muted">{date(unit.deliveredAt)}</span>
                      ) : null}
                    </div>

                    {unit.activationCode ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted">{t("order.activationCode")}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <code className="ltr-value rounded-lg bg-page px-3 py-2 text-sm font-bold ring-1 ring-line">
                            {unit.activationCode}
                          </code>
                          <CopyButton value={unit.activationCode} label={t("order.copyCode")} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">{t("order.activationCode")}: {t("common.notProvided")}</p>
                    )}

                    {unit.qrPath ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-muted">{t("order.qrCode")}</p>
                        <div className="mt-2 flex flex-wrap items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/orders/${order.reference}/qr?unit=${unit.id}`}
                            alt={t("order.qrCode")}
                            className="h-44 w-44 rounded-xl border border-line bg-white object-contain p-2"
                          />
                          <a
                            href={`/api/orders/${order.reference}/qr?unit=${unit.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            <DownloadIcon size={15} /> {t("order.downloadQr")}
                          </a>
                        </div>
                      </div>
                    ) : null}

                    {unit.instructions ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-muted">{t("order.instructions")}</p>
                        <p className="mt-1 whitespace-pre-line text-xs leading-6 text-ink-soft">{unit.instructions}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
                <p className="flex items-start gap-2 text-[11px] leading-5 text-muted">
                  <ShieldIcon size={15} className="mt-0.5 shrink-0" />
                  {t("order.secureDeliveryNote")}
                </p>
              </div>
            )}
          </section>

          {order.history.length > 0 ? (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-bold">{t("order.statusHistory")}</h2>
              <ol className="mt-4 space-y-4">
                {order.history.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                      <CheckIcon size={13} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{t(`status.${entry.toStatus}`)}</p>
                      <p className="text-[11px] text-muted">{date(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="card p-5">
            <h2 className="text-sm font-bold">{t("order.customer")}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">{t("order.customer")}</dt>
                <dd className="font-semibold">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("order.phone")}</dt>
                <dd><bdi className="ltr-value font-semibold">{order.customerPhone}</bdi></dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("order.items")}</dt>
                <dd className="font-semibold">{t("order.orderItemsCount", { count: itemCount })}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <QrIcon size={17} /> {t("order.secureNote")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">{t("order.saveLink")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href={`/${locale}/track`} className="btn btn-secondary btn-sm">{t("order.trackOrder")}</Link>
              <Link href={`/${locale}/support`} className="btn btn-ghost btn-sm">{t("order.contactSupport")}</Link>
            </div>
          </section>

          <TelegramLinkCard
            reference={order.reference}
            configured={env.isTelegramConfigured}
            botUsername={env.telegramBotUsername}
          />
        </aside>
      </div>
    </div>
  );
}
