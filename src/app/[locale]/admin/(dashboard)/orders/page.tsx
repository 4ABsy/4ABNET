import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  isLocale,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type Locale,
} from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { textContains } from "@/lib/db-search";
import { StatusBadge } from "@/components/status-badge";
import { AdminFlash } from "@/components/admin/flash";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Search = {
  q?: string;
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  page?: string;
  ok?: string;
  error?: string;
};

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminOrdersPage({
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
  if (!hasPermission(ctx, "orders.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const q = single(query.q).trim();
  const status = single(query.status);
  const payment = single(query.payment);
  const from = single(query.from);
  const to = single(query.to);
  const page = Math.max(1, Number.parseInt(single(query.page), 10) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (q) {
    where.OR = [
      { reference: textContains(q.toUpperCase()) },
      { customerPhone: textContains(q) },
      { customerName: textContains(q) },
    ];
  }
  if ((ORDER_STATUSES as readonly string[]).includes(status)) where.status = status;
  if ((PAYMENT_STATUSES as readonly string[]).includes(payment)) where.paymentStatus = payment;
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const start = new Date(`${from}T00:00:00`);
    if (Number.isFinite(start.getTime())) createdAt.gte = start;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const end = new Date(`${to}T23:59:59.999`);
    if (Number.isFinite(end.getTime())) createdAt.lte = end;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { customer: { select: { name: true, phone: true } }, items: { select: { quantity: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (status) baseParams.set("status", status);
  if (payment) baseParams.set("payment", payment);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);
  const pageHref = (target: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(target));
    return `/${locale}/admin/orders?${params.toString()}`;
  };

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.orders.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.orders.subtitle")}</p>
        </div>
        <p className="text-sm font-semibold text-muted">{t("product.resultsCount", { count: total })}</p>
      </div>

      <form method="get" className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="order-q" className="label">{t("common.search")}</label>
          <input id="order-q" name="q" defaultValue={q} placeholder={t("admin.orders.searchPlaceholder")} className="input" />
        </div>
        <div>
          <label htmlFor="order-status" className="label">{t("admin.orders.filterStatus")}</label>
          <select id="order-status" name="status" defaultValue={status} className="input">
            <option value="">{t("common.all")}</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>{t(`status.${value}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="order-payment" className="label">{t("admin.orders.filterPayment")}</label>
          <select id="order-payment" name="payment" defaultValue={payment} className="input">
            <option value="">{t("common.all")}</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>{t(`paymentStatus.${value}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="order-from" className="label">{t("admin.orders.filterFrom")}</label>
          <input id="order-from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label htmlFor="order-to" className="label">{t("admin.orders.filterTo")}</label>
          <input id="order-to" name="to" type="date" defaultValue={to} className="input" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="btn btn-primary btn-sm">{t("admin.orders.apply")}</button>
          <Link href={`/${locale}/admin/orders`} className="btn btn-secondary btn-sm">{t("admin.orders.reset")}</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.orders.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("order.reference")}</th>
                <th>{t("admin.orders.customer")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.total")}</th>
                <th>{t("admin.orders.created")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/${locale}/admin/orders/${order.id}`} className="font-bold text-brand-ink ltr-value" dir="ltr">
                        {order.reference}
                      </Link>
                      <p className="text-[11px] text-muted">{t("order.orderItemsCount", { count: itemCount })}</p>
                    </td>
                    <td>
                      <p className="font-semibold">{order.customerName}</p>
                      <p className="text-xs text-muted ltr-value" dir="ltr">{order.customerPhone}</p>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge kind="order" status={order.status} label={t(`status.${order.status}`)} />
                        <StatusBadge kind="payment" status={order.paymentStatus} label={t(`paymentStatus.${order.paymentStatus}`)} />
                      </div>
                    </td>
                    <td className="font-bold">{money(order.totalMinor)}</td>
                    <td className="text-xs text-muted">{date(order.createdAt)}</td>
                    <td>
                      <Link href={`/${locale}/admin/orders/${order.id}`} className="btn btn-secondary btn-sm">
                        {t("admin.orders.view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label={t("common.page")}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">{t("common.previous")}</Link>
          ) : null}
          <span className="text-sm text-muted">
            {t("common.page")} {page} {t("common.of")} {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">{t("common.next")}</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
