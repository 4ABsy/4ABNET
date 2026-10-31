import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { getAdminOrder } from "@/lib/order-view";
import { getSettings, settingBool } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import {
  assignInventoryAction,
  cancelOrderAction,
  confirmOrderAction,
  deliverOrderAction,
  refundOrderAction,
  rejectPaymentAction,
  startProcessingAction,
  updateOrderNoteAction,
  verifyPaymentAction,
} from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function maskCode(code: string): string {
  const tail = code.slice(-4);
  return `••••••${tail}`;
}

function Metadata({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; count?: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "orders.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const order = await getAdminOrder(id);
  if (!order) notFound();

  const query = await searchParams;
  const settings = await getSettings();
  const canReviewPayments = hasPermission(ctx, "payments.review");
  const canViewReceipts = hasPermission(ctx, "payments.receipts.view");
  const canDeliver = hasPermission(ctx, "inventory.deliver");
  const canAssign = canDeliver;
  const canUpdate = hasPermission(ctx, "orders.update");
  const canConfirm = hasPermission(ctx, "orders.confirm");

  const items = order.items;
  const requiredUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const assignedUnits = order.inventory.filter((unit) => unit.status === "ASSIGNED").length;
  const deliveredUnits = order.inventory.filter((unit) => unit.deliveredAt).length;
  const bankDetails = {
    name: String(settings[SETTING_KEYS.bankAccountName] ?? ""),
    iban: String(settings[SETTING_KEYS.bankIban] ?? ""),
  };
  const ordersEnabled = settingBool(settings, SETTING_KEYS.ordersEnabled);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const cancelable = ["AWAITING_CONFIRMATION", "AWAITING_PAYMENT", "PAYMENT_REVIEW", "CONFIRMED", "PROCESSING"].includes(
    order.status,
  );

  return (
    <div>
      <AdminFlash
        locale={locale}
        ok={query.ok}
        error={query.error}
        count={query.count}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/${locale}/admin/orders`} className="link text-xs font-semibold">
            ← {t("admin.orderDetail.back")}
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-ink ltr-value" dir="ltr">
            {order.reference}
          </h1>
          <p className="mt-1 text-sm text-muted">{date(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge kind="order" status={order.status} label={t(`status.${order.status}`)} />
          <StatusBadge kind="payment" status={order.paymentStatus} label={t(`paymentStatus.${order.paymentStatus}`)} />
        </div>
      </div>

      {!ordersEnabled ? (
        <p className="mt-4 rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
          {t("admin.settings.ordersPausedWarning")}
        </p>
      ) : null}

      {order.paymentMethod === "CASH_ON_DELIVERY" && order.status !== "DELIVERED" ? (
        <p className="mt-4 rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
          {t("admin.orderDetail.codInfo")}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="text-lg font-bold">{t("admin.orderDetail.summary")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metadata label={t("admin.orderDetail.orderTotal")}>
                <span className="text-lg font-extrabold">{money(order.totalMinor)}</span>
              </Metadata>
              <Metadata label={t("admin.orderDetail.paymentMethodLabel")}>
                {t(`paymentMethod.${order.paymentMethod}`)}
              </Metadata>
              <Metadata label={t("admin.orderDetail.paymentStatusLabel")}>
                {t(`paymentStatus.${order.paymentStatus}`)}
              </Metadata>
              <Metadata label={t("admin.orderDetail.createdAt")}>{date(order.createdAt)}</Metadata>
            </div>

            <h3 className="mt-6 text-sm font-bold">{t("admin.orderDetail.items")}</h3>
            <div className="table-wrap mt-2">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("admin.products.name")}</th>
                    <th>{t("common.quantity")}</th>
                    <th>{t("admin.products.price")}</th>
                    <th>{t("common.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-semibold">{item.productName}</span>
                        <p className="text-[11px] text-muted ltr-value" dir="ltr">{item.productSlug}</p>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPriceMinor)}</td>
                      <td className="font-bold">{money(item.lineTotalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm">
              <span className="text-muted">{t("common.subtotal")}: {money(order.subtotalMinor)}</span>
              <span className="text-muted">
                {t("common.discount")}: {money(order.discountMinor)}
                {order.couponCode ? (
                  <span className="ms-1 ltr-value" dir="ltr">({order.couponCode})</span>
                ) : null}
              </span>
              <strong>{t("common.total")}: {money(order.totalMinor)}</strong>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">{t("admin.orderDetail.paymentInfo")}</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metadata label={t("admin.orderDetail.paymentMethodLabel")}>
                {t(`paymentMethod.${order.payment?.method ?? order.paymentMethod}`)}
              </Metadata>
              <Metadata label={t("admin.orderDetail.paymentStatusLabel")}>
                {t(`paymentStatus.${order.paymentStatus}`)}
              </Metadata>
              <Metadata label={t("common.total")}>{money(order.payment?.amountMinor ?? order.totalMinor)}</Metadata>
              <Metadata label={t("admin.orders.receipt")}>
                {order.receipts.length ? String(order.receipts.length) : t("admin.orders.noReceipt")}
              </Metadata>
            </dl>

            {order.paymentMethod === "BANK_TRANSFER" ? (
              <p className="mt-3 rounded-xl bg-page p-3 text-xs leading-6 text-ink-soft" dir="auto">
                {bankDetails.name} — <span className="ltr-value" dir="ltr">{bankDetails.iban}</span>
              </p>
            ) : null}

            <h3 className="mt-5 text-sm font-bold">{t("admin.orders.receipt")}</h3>
            {order.receipts.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t("admin.orders.noReceipt")}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {order.receipts.map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" dir="auto">{receipt.originalName}</p>
                      <p className="text-[11px] text-muted">
                        {t("admin.orderDetail.receiptMeta", {
                          name: date(receipt.uploadedAt),
                          size: formatBytes(receipt.sizeBytes),
                        })}
                      </p>
                    </div>
                    {canViewReceipts ? (
                      <a
                        href={`/api/admin/receipts/${receipt.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        {t("admin.orders.downloadReceipt")}
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted">{t("admin.orderDetail.noReceiptPermission")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canReviewPayments && order.status === "PAYMENT_REVIEW" ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <ConfirmForm
                  action={verifyPaymentAction}
                  message={t("admin.orders.verifyConfirm")}
                  className="space-y-2"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <label htmlFor="verify-note" className="label">{t("admin.orders.note")}</label>
                  <input id="verify-note" name="note" maxLength={500} className="input" />
                  <button type="submit" className="btn btn-primary w-full">
                    {t("admin.orders.verifyPayment")}
                  </button>
                </ConfirmForm>

                <ConfirmForm
                  action={rejectPaymentAction}
                  message={t("admin.orders.rejectConfirm")}
                  className="space-y-2"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <label htmlFor="reject-note" className="label">{t("admin.orders.rejectReason")}</label>
                  <input id="reject-note" name="note" maxLength={500} className="input" />
                  <button type="submit" className="btn btn-danger w-full">
                    {t("admin.orders.rejectPayment")}
                  </button>
                </ConfirmForm>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{t("admin.orderDetail.delivery")}</h2>
              <span className="text-xs font-semibold text-muted">
                {assignedUnits}/{requiredUnits}
              </span>
            </div>
            <p className="mt-1 text-xs leading-6 text-muted">{t("admin.orderDetail.deliveryHint")}</p>

            {order.inventory.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("admin.orderDetail.noUnits")}</p>
            ) : (
              <div className="table-wrap mt-3">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("admin.inventory.product")}</th>
                      <th>{t("admin.orderDetail.unitStatusLabel")}</th>
                      <th>{t("admin.orderDetail.unitCode")}</th>
                      <th>{t("admin.orderDetail.qr")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.inventory.map((unit) => {
                      const item = unit.orderItemId ? itemById.get(unit.orderItemId) : null;
                      return (
                        <tr key={unit.id}>
                          <td>
                            <p className="text-sm font-semibold">{item?.productName ?? "—"}</p>
                            <p className="text-[11px] text-muted">
                              {t("admin.orderDetail.assignedAt")}: {unit.assignedAt ? date(unit.assignedAt) : t("common.notProvided")}
                            </p>
                          </td>
                          <td>
                            <StatusBadge
                              kind="inventory"
                              status={unit.status}
                              label={t(`admin.inventory.${unit.status.toLowerCase()}`)}
                            />
                          </td>
                          <td>
                            <span className="text-xs font-semibold ltr-value" dir="ltr">
                              {unit.activationCode
                                ? canDeliver
                                  ? unit.activationCode
                                  : maskCode(unit.activationCode)
                                : t("common.notProvided")}
                            </span>
                            {!canDeliver && unit.activationCode ? (
                              <p className="text-[10px] text-muted">{t("admin.orderDetail.maskedCode")}</p>
                            ) : null}
                          </td>
                          <td>
                            {unit.qrPath && canDeliver ? (
                              <a
                                href={`/api/admin/delivery/${unit.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link text-xs font-semibold"
                              >
                                {t("admin.orderDetail.downloadQr")}
                              </a>
                            ) : (
                              <span className="text-xs text-muted">
                                {unit.qrPath ? t("admin.orderDetail.maskedCode") : t("common.notProvided")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {assignedUnits >= requiredUnits && requiredUnits > 0 ? (
              <p className="mt-3 rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">
                {order.status === "DELIVERED"
                  ? t("admin.orderDetail.deliveredNotice")
                  : t("admin.orders.deliverBody")}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {canAssign &&
              ["CONFIRMED", "PROCESSING", "AWAITING_CONFIRMATION"].includes(order.status) &&
              assignedUnits < requiredUnits ? (
                <ConfirmForm action={assignInventoryAction} message={t("admin.orders.assignBody")}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <button type="submit" className="btn btn-secondary">
                    {t("admin.orders.assignAuto")}
                  </button>
                </ConfirmForm>
              ) : null}

              {canDeliver && ["CONFIRMED", "PROCESSING"].includes(order.status) ? (
                <ConfirmForm action={deliverOrderAction} message={t("admin.orders.deliverBody")}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <button type="submit" className="btn btn-primary" disabled={assignedUnits < requiredUnits}>
                    {t("admin.orders.deliver")}
                  </button>
                </ConfirmForm>
              ) : null}

              {canUpdate && order.status === "CONFIRMED" ? (
                <form action={startProcessingAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <button type="submit" className="btn btn-secondary">
                    {t("admin.orders.markProcessing")}
                  </button>
                </form>
              ) : null}

              {canConfirm && order.status === "AWAITING_CONFIRMATION" ? (
                <ConfirmForm action={confirmOrderAction} message={t("admin.orders.confirmAction")}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                  <button type="submit" className="btn btn-primary">
                    {t("admin.orders.confirm")}
                  </button>
                </ConfirmForm>
              ) : null}
            </div>
          </section>

          {canReviewPayments && order.status === "DELIVERED" ? (
            <section className="card p-5">
              <h2 className="text-lg font-bold">{t("status.REFUNDED")}</h2>
              <p className="mt-1 text-xs leading-6 text-muted">{t("admin.orderDetail.refundConfirm")}</p>
              <ConfirmForm action={refundOrderAction} message={t("admin.orderDetail.refundConfirm")} className="mt-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                <button type="submit" className="btn btn-danger">
                  {t("status.REFUNDED")}
                </button>
              </ConfirmForm>
            </section>
          ) : null}

          {order.note ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold">{t("admin.orders.customerNote")}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-soft" dir="auto">
                {order.note}
              </p>
            </section>
          ) : null}
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="text-lg font-bold">{t("admin.orderDetail.customerInfo")}</h2>
            <dl className="mt-4 space-y-3">
              <Metadata label={t("admin.customers.name")}>{order.customerName}</Metadata>
              <Metadata label={t("admin.customers.phone")}>
                <span className="ltr-value" dir="ltr">{order.customerPhone}</span>
              </Metadata>
              <Metadata label={t("admin.customers.telegram")}>
                {order.customer.telegramId ? (
                  <span className="ltr-value" dir="ltr">
                    {order.customer.telegramUsername ? `@${order.customer.telegramUsername}` : order.customer.telegramId}
                  </span>
                ) : (
                  t("admin.customers.notLinked")
                )}
              </Metadata>
              <Metadata label={t("admin.customers.locale")}>{order.customer.locale.toUpperCase()}</Metadata>
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-muted">{t("admin.orderDetail.phoneVerified")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                {t("admin.orders.whatsapp")}
              </a>
              <Link
                href={`/${locale}/admin/orders?q=${encodeURIComponent(order.customerPhone)}`}
                className="btn btn-ghost btn-sm"
              >
                {t("admin.orderDetail.customerOrders")}
              </Link>
            </div>
          </section>

          {canUpdate ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold">{t("admin.orderDetail.internalNote")}</h2>
              <p className="mt-1 text-[11px] leading-5 text-muted">{t("admin.orderDetail.internalNoteHint")}</p>
              <form action={updateOrderNoteAction} className="mt-3 space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                <label htmlFor="admin-note" className="sr-only">{t("admin.orderDetail.internalNote")}</label>
                <textarea
                  id="admin-note"
                  name="adminNote"
                  defaultValue={order.adminNote ?? ""}
                  maxLength={1000}
                  rows={4}
                  className="input"
                />
                <button type="submit" className="btn btn-secondary btn-sm">
                  {t("admin.orders.addNote")}
                </button>
              </form>
            </section>
          ) : null}

          {canConfirm && cancelable ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold">{t("admin.orders.cancel")}</h2>
              <p className="mt-1 text-[11px] leading-5 text-muted">{t("admin.orders.cancelConfirm")}</p>
              <ConfirmForm
                action={cancelOrderAction}
                message={t("admin.orders.cancelConfirm")}
                className="mt-3 space-y-2"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="returnTo" value={`/${locale}/admin/orders/${order.id}`} />
                <label htmlFor="cancel-note" className="label">{t("admin.orderDetail.cancelReason")}</label>
                <input id="cancel-note" name="note" maxLength={500} className="input" />
                <button type="submit" className="btn btn-danger w-full">
                  {t("admin.orders.cancelAction")}
                </button>
              </ConfirmForm>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="text-sm font-bold">{t("admin.orderDetail.timeline")}</h2>
            <ol className="mt-3 space-y-3">
              {order.history.map((entry) => (
                <li key={entry.id} className="border-s-2 border-brand-soft ps-3">
                  <p className="text-xs font-bold">
                    {entry.fromStatus ? `${t(`status.${entry.fromStatus}`)} → ` : ""}
                    {t(`status.${entry.toStatus}`)}
                  </p>
                  <p className="text-[11px] text-muted">{date(entry.createdAt)}</p>
                  <p className="text-[11px] text-muted">
                    {entry.actorType === "ADMIN"
                      ? entry.admin?.name ?? t("admin.orderDetail.admin")
                      : entry.actorType === "TELEGRAM"
                        ? t("admin.orderDetail.telegram")
                        : t("admin.orderDetail.system")}
                  </p>
                  {entry.note ? <p className="mt-1 text-[11px] text-ink-soft" dir="auto">{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5 text-xs leading-6 text-muted">
            <p>{t("admin.orderDetail.createdAt")}: {date(order.createdAt)}</p>
            <p>{t("admin.orderDetail.updatedAt")}: {date(order.updatedAt)}</p>
            <p>{t("admin.orderDetail.assignedAt")}: {assignedUnits}/{requiredUnits}</p>
            <p>{t("admin.orderDetail.deliveredAt")}: {deliveredUnits}</p>
          </section>
        </div>
      </div>

      {!canReviewPayments && !canDeliver && !canUpdate && !canConfirm ? (
        <p className="mt-5 rounded-xl bg-page p-4 text-center text-sm text-muted">
          {t("admin.orderDetail.noActionsHint")}
        </p>
      ) : null}
    </div>
  );
}
