import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { AdminFlash } from "@/components/admin/flash";
import { BoxIcon, CartIcon, CheckIcon, GridIcon, ReceiptIcon, UsersIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "dashboard.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }
  const query = await searchParams;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 6);

  const paidStatuses = ["CONFIRMED", "PROCESSING", "DELIVERED"];
  const [totalOrders, awaitingConfirmation, pendingPayments, deliveredOrders, activeProducts, availableUnits, todaySales, weekSales, recentOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "AWAITING_CONFIRMATION" } }),
      prisma.order.count({ where: { status: "PAYMENT_REVIEW" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.product.count({ where: { isActive: true, isArchived: false } }),
      prisma.inventoryUnit.count({ where: { status: "AVAILABLE" } }),
      prisma.order.aggregate({
        where: { status: { in: paidStatuses }, createdAt: { gte: startToday } },
        _sum: { totalMinor: true },
      }),
      prisma.order.aggregate({
        where: { status: { in: paidStatuses }, createdAt: { gte: startWeek } },
        _sum: { totalMinor: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: { select: { name: true, phone: true } } },
      }),
    ]);

  const cards = [
    {
      label: t("admin.stats.awaitingConfirmation"),
      value: String(awaitingConfirmation),
      icon: <ReceiptIcon size={18} />,
      href: `/${locale}/admin/orders?status=AWAITING_CONFIRMATION`,
    },
    {
      label: t("admin.stats.pendingPayments"),
      value: String(pendingPayments),
      icon: <CheckIcon size={18} />,
      href: `/${locale}/admin/orders?status=PAYMENT_REVIEW`,
    },
    {
      label: t("admin.stats.todaySales"),
      value: money(todaySales._sum.totalMinor ?? 0),
      icon: <CartIcon size={18} />,
      href: `/${locale}/admin/orders`,
    },
    {
      label: t("admin.stats.weekSales"),
      value: money(weekSales._sum.totalMinor ?? 0),
      icon: <GridIcon size={18} />,
      href: `/${locale}/admin/orders`,
    },
    {
      label: t("admin.stats.totalOrders"),
      value: String(totalOrders),
      icon: <CartIcon size={18} />,
      href: `/${locale}/admin/orders`,
    },
    {
      label: t("admin.stats.deliveredOrders"),
      value: String(deliveredOrders),
      icon: <CheckIcon size={18} />,
      href: `/${locale}/admin/orders?status=DELIVERED`,
    },
    {
      label: t("admin.stats.activeProducts"),
      value: String(activeProducts),
      icon: <BoxIcon size={18} />,
      href: `/${locale}/admin/products`,
    },
    {
      label: t("admin.stats.availableUnits"),
      value: String(availableUnits),
      icon: <UsersIcon size={18} />,
      href: `/${locale}/admin/inventory`,
    },
  ];

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.dashboard")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.welcome")}, {ctx?.name}</p>
        </div>
        <Link href={`/${locale}/admin/orders?status=PAYMENT_REVIEW`} className="btn btn-primary btn-sm">
          {t("admin.stats.pendingPayments")}
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              {card.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-muted">{card.label}</span>
              <span className="mt-0.5 block truncate text-lg font-extrabold text-ink" dir="auto">{card.value}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{t("admin.stats.recentOrders")}</h2>
          <Link href={`/${locale}/admin/orders`} className="link text-sm font-semibold">
            {t("admin.stats.viewAllOrders")}
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState title={t("admin.stats.noRecentOrders")} />
          </div>
        ) : (
          <div className="table-wrap mt-4">
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
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/${locale}/admin/orders/${order.id}`} className="font-bold text-brand-ink ltr-value" dir="ltr">
                        {order.reference}
                      </Link>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
