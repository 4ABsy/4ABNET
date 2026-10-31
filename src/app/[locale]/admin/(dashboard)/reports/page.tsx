import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = ["CONFIRMED", "PROCESSING", "DELIVERED"];
const ISTANBUL_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayKey(date: Date): string {
  return ISTANBUL_DAY.format(date);
}

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const ctx = await getAdminSession();

  if (!hasPermission(ctx, "reports.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const now = new Date();
  const start = new Date(now.getTime() - 29 * DAY_MS);
  start.setHours(0, 0, 0, 0);

  const [paidOrders, delivered, cancelled, pendingPayments, topProducts, products, availableGroups] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: { in: PAID_STATUSES }, createdAt: { gte: start } },
        select: { totalMinor: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.count({ where: { status: "DELIVERED", createdAt: { gte: start } } }),
      prisma.order.count({ where: { status: "CANCELLED", createdAt: { gte: start } } }),
      prisma.order.count({ where: { status: "PAYMENT_REVIEW" } }),
      prisma.orderItem.groupBy({
        by: ["productName"],
        where: {
          order: { status: { in: PAID_STATUSES }, createdAt: { gte: start } },
        },
        _sum: { quantity: true, lineTotalMinor: true },
        orderBy: { _sum: { lineTotalMinor: "desc" } },
        take: 8,
      }),
      prisma.product.findMany({
        where: { isArchived: false },
        include: { translations: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.inventoryUnit.groupBy({
        by: ["productId"],
        where: { status: "AVAILABLE" },
        _count: { _all: true },
      }),
    ]);

  const revenue = paidOrders.reduce((sum, order) => sum + order.totalMinor, 0);
  const average = paidOrders.length ? Math.round(revenue / paidOrders.length) : 0;
  const availableByProduct = new Map(
    availableGroups.map((group) => [group.productId, group._count._all]),
  );

  const daily = Array.from({ length: 14 }, (_, index) => {
    const dateValue = new Date(now.getTime() - (13 - index) * DAY_MS);
    return {
      key: dayKey(dateValue),
      label: new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Istanbul",
      }).format(dateValue),
      value: 0,
    };
  });
  const dailyByKey = new Map(daily.map((entry) => [entry.key, entry]));
  for (const order of paidOrders) {
    const entry = dailyByKey.get(dayKey(order.createdAt));
    if (entry) entry.value += order.totalMinor;
  }
  const dailyMax = Math.max(...daily.map((entry) => entry.value), 1);

  const inventory = products
    .map((product) => ({
      id: product.id,
      name: pickTranslation(product.translations, locale)?.name ?? product.slug,
      available: availableByProduct.get(product.id) ?? 0,
    }))
    .sort((a, b) => a.available - b.available)
    .slice(0, 10);

  const cards = [
    { label: t("admin.reports.revenue"), value: money(revenue) },
    { label: t("admin.reports.paidOrders"), value: String(paidOrders.length) },
    { label: t("admin.reports.averageOrder"), value: money(average) },
    { label: t("admin.reports.delivered"), value: String(delivered) },
    { label: t("admin.reports.cancelled"), value: String(cancelled) },
    { label: t("admin.reports.pendingPayments"), value: String(pendingPayments) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.reports.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.reports.subtitle")}</p>
        </div>
        <span className="badge badge-neutral">{t("admin.reports.last30")}</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="card p-4">
            <p className="text-[11px] font-semibold text-muted">{card.label}</p>
            <p className="mt-1 text-xl font-extrabold text-ink" dir="auto">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-bold">{t("admin.reports.byDay")}</h2>
          <div className="mt-4 space-y-2">
            {daily.map((entry) => (
              <div key={entry.key} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[11px] text-muted ltr-value" dir="ltr">
                  {entry.label}
                </span>
                <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-page">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max((entry.value / dailyMax) * 100, entry.value > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-end text-[11px] font-semibold text-ink" dir="auto">
                  {money(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">{t("admin.reports.topProducts")}</h2>
          {topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.reports.noData")}</p>
          ) : (
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("admin.reports.product")}</th>
                    <th>{t("admin.reports.quantity")}</th>
                    <th>{t("admin.reports.revenueCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product) => (
                    <tr key={product.productName}>
                      <td className="font-semibold">{product.productName}</td>
                      <td>{product._sum.quantity ?? 0}</td>
                      <td className="font-bold">{money(product._sum.lineTotalMinor ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="text-lg font-bold">{t("admin.reports.inventory")}</h2>
        {inventory.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("admin.reports.noData")}</p>
        ) : (
          <div className="table-wrap mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.reports.product")}</th>
                  <th>{t("admin.reports.available")}</th>
                  <th>{t("admin.orders.created")}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((product) => {
                  const stock = products.find((entry) => entry.id === product.id);
                  return (
                    <tr key={product.id}>
                      <td className="font-semibold">{product.name}</td>
                      <td>
                        <span
                          className={
                            product.available === 0
                              ? "badge badge-danger"
                              : product.available < 3
                                ? "badge badge-warning"
                                : "badge badge-success"
                          }
                        >
                          {product.available}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        {stock ? date(stock.createdAt) : t("common.notProvided")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
