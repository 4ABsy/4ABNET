import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { textContains } from "@/lib/db-search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "customers.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const where: Prisma.CustomerWhereInput = q
    ? { OR: [{ name: textContains(q) }, { phone: textContains(q) }] }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        orders: { select: { totalMinor: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.customers.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("product.resultsCount", { count: total })}</p>
        </div>
      </div>

      <form method="get" className="card mt-5 flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="customer-q" className="label">{t("common.search")}</label>
          <input
            id="customer-q"
            name="q"
            defaultValue={q}
            placeholder={`${t("admin.customers.name")} / ${t("admin.customers.phone")}`}
            className="input"
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-sm">{t("common.search")}</button>
        <Link href={`/${locale}/admin/customers`} className="btn btn-ghost btn-sm">{t("common.reset")}</Link>
      </form>

      {customers.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.customers.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.customers.name")}</th>
                <th>{t("admin.customers.phone")}</th>
                <th>{t("admin.customers.telegram")}</th>
                <th>{t("admin.customers.orders")}</th>
                <th>{t("admin.customers.joined")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const orderCount = customer.orders.length;
                const paidTotal = customer.orders
                  .filter((order) => ["CONFIRMED", "PROCESSING", "DELIVERED"].includes(order.status))
                  .reduce((sum, order) => sum + order.totalMinor, 0);
                return (
                  <tr key={customer.id}>
                    <td>
                      <p className="font-semibold">{customer.name}</p>
                      <p className="text-[11px] text-muted">{customer.locale.toUpperCase()}</p>
                    </td>
                    <td>
                      <span className="ltr-value" dir="ltr">{customer.phone}</span>
                    </td>
                    <td>
                      {customer.telegramId ? (
                        <span className="badge badge-success">{t("admin.customers.linked")}</span>
                      ) : (
                        <span className="badge badge-neutral">{t("admin.customers.notLinked")}</span>
                      )}
                      {customer.telegramUsername ? (
                        <p className="mt-1 text-[11px] text-muted ltr-value" dir="ltr">
                          @{customer.telegramUsername}
                        </p>
                      ) : null}
                    </td>
                    <td>
                      <p className="font-bold">{orderCount}</p>
                      <p className="text-[11px] text-muted">{money(paidTotal)}</p>
                    </td>
                    <td className="text-xs text-muted">{date(customer.createdAt)}</td>
                    <td>
                      <Link
                        href={`/${locale}/admin/orders?q=${encodeURIComponent(customer.phone)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        {t("admin.customers.viewOrders")}
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
            <Link href={`/${locale}/admin/customers?q=${encodeURIComponent(q)}&page=${page - 1}`} className="btn btn-secondary btn-sm">
              {t("common.previous")}
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            {t("common.page")} {page} {t("common.of")} {pages}
          </span>
          {page < pages ? (
            <Link href={`/${locale}/admin/customers?q=${encodeURIComponent(q)}&page=${page + 1}`} className="btn btn-secondary btn-sm">
              {t("common.next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
