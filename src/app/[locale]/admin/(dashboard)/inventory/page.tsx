import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  INVENTORY_STATUSES,
  isLocale,
  type Locale,
} from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/catalog";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import {
  createInventoryAction,
  releaseInventoryAction,
  revokeInventoryAction,
} from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Search = {
  product?: string;
  status?: string;
  page?: string;
  ok?: string;
  error?: string;
  count?: string;
};

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function masked(code: string | null): string {
  if (!code) return "—";
  return `••••••${code.slice(-4)}`;
}

export default async function AdminInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "inventory.manage") && !hasPermission(ctx, "inventory.deliver")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const canManage = hasPermission(ctx, "inventory.manage");
  const canSeeCodes = hasPermission(ctx, "inventory.deliver");
  const query = await searchParams;
  const product = single(query.product);
  const status = single(query.status);
  const page = Math.max(1, Number.parseInt(single(query.page), 10) || 1);

  const where: Prisma.InventoryUnitWhereInput = {};
  if (product) where.productId = product;
  if ((INVENTORY_STATUSES as readonly string[]).includes(status)) where.status = status;

  const [total, units, products, grouped] = await Promise.all([
    prisma.inventoryUnit.count({ where }),
    prisma.inventoryUnit.findMany({
      where,
      include: {
        product: { include: { translations: true } },
        order: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.findMany({
      where: { isArchived: false },
      include: { translations: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.inventoryUnit.groupBy({
      by: ["productId", "status"],
      where: product ? { productId: product } : undefined,
      _count: { _all: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const available = grouped
    .filter((entry) => entry.status === "AVAILABLE")
    .reduce((sum, entry) => sum + entry._count._all, 0);
  const reserved = grouped
    .filter((entry) => entry.status === "RESERVED")
    .reduce((sum, entry) => sum + entry._count._all, 0);
  const assigned = grouped
    .filter((entry) => entry.status === "ASSIGNED")
    .reduce((sum, entry) => sum + entry._count._all, 0);

  const baseParams = new URLSearchParams();
  if (product) baseParams.set("product", product);
  if (status) baseParams.set("status", status);
  const pageHref = (target: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(target));
    return `/${locale}/admin/inventory?${params.toString()}`;
  };
  const selectedProduct = products.find((entry) => entry.id === product);

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} count={query.count} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.inventory.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="badge badge-success">{t("admin.inventory.available")}: {available}</span>
          <span className="badge badge-warning">{t("admin.inventory.reserved")}: {reserved}</span>
          <span className="badge badge-brand">{t("admin.inventory.assigned")}: {assigned}</span>
        </div>
      </div>

      <form method="get" className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="inventory-product" className="label">{t("admin.inventory.product")}</label>
          <select id="inventory-product" name="product" defaultValue={product} className="input">
            <option value="">{t("common.all")}</option>
            {products.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {pickTranslation(entry.translations, locale)?.name ?? entry.slug}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inventory-status" className="label">{t("admin.inventory.status")}</label>
          <select id="inventory-status" name="status" defaultValue={status} className="input">
            <option value="">{t("common.all")}</option>
            {INVENTORY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`admin.inventory.${value.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-secondary btn-sm">{t("common.filter")}</button>
          <Link href={`/${locale}/admin/inventory`} className="btn btn-ghost btn-sm">{t("common.reset")}</Link>
        </div>
      </form>

      {canManage ? (
        <section className="card mt-5 p-5">
          <h2 className="text-lg font-bold">{t("admin.inventory.addTitle")}</h2>
          <p className="mt-1 text-xs leading-6 text-muted">{t("admin.inventory.sensitiveNote")}</p>
          <form action={createInventoryAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={`/${locale}/admin/inventory`} />
            <div className="sm:col-span-2">
              <label htmlFor="new-unit-product" className="label">{t("admin.inventory.product")}</label>
              <select
                id="new-unit-product"
                name="productId"
                required
                defaultValue={product}
                className="input"
              >
                <option value="">{t("admin.inventory.noProduct")}</option>
                {products.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {pickTranslation(entry.translations, locale)?.name ?? entry.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-unit-count" className="label">{t("admin.inventory.bulkCount")}</label>
              <input
                id="new-unit-count"
                name="count"
                type="number"
                min={1}
                max={50}
                defaultValue={1}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="new-unit-qr" className="label">{t("admin.inventory.qrUpload")}</label>
              <input
                id="new-unit-qr"
                name="qrFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="input"
              />
              <p className="hint">{t("admin.inventory.qrOnlySingle")}</p>
            </div>
            <div>
              <label htmlFor="new-unit-code" className="label">{t("admin.inventory.activationCode")}</label>
              <input
                id="new-unit-code"
                name="activationCode"
                maxLength={500}
                dir="ltr"
                autoComplete="off"
                className="input ltr-value"
              />
              <p className="hint">{t("admin.inventory.codeHint")}</p>
            </div>
            <div>
              <label htmlFor="new-unit-instructions" className="label">{t("admin.inventory.instructions")}</label>
              <textarea
                id="new-unit-instructions"
                name="instructions"
                rows={2}
                maxLength={2000}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-unit-notes" className="label">{t("common.note")}</label>
              <textarea
                id="new-unit-notes"
                name="notes"
                rows={2}
                maxLength={1000}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary">{t("admin.inventory.create")}</button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">
          {selectedProduct
            ? `${t("admin.inventory.unitsFor")}: ${pickTranslation(selectedProduct.translations, locale)?.name ?? selectedProduct.slug}`
            : t("admin.inventory.title")}
        </h2>
        <span className="text-sm text-muted">{t("product.resultsCount", { count: total })}</span>
      </div>

      {units.length === 0 ? (
        <p className="card mt-3 p-6 text-center text-sm text-muted">{t("admin.inventory.empty")}</p>
      ) : (
        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.inventory.product")}</th>
                <th>{t("admin.inventory.status")}</th>
                <th>{t("admin.inventory.activationCode")}</th>
                <th>{t("admin.inventory.qr")}</th>
                <th>{t("admin.inventory.order")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td>
                    <p className="text-sm font-semibold">
                      {pickTranslation(unit.product.translations, locale)?.name ?? unit.product.slug}
                    </p>
                    <p className="text-[11px] text-muted">{date(unit.createdAt)}</p>
                  </td>
                  <td>
                    <span
                      className={
                        unit.status === "AVAILABLE"
                          ? "badge badge-success"
                          : unit.status === "RESERVED"
                            ? "badge badge-warning"
                            : unit.status === "ASSIGNED"
                              ? "badge badge-brand"
                              : "badge badge-danger"
                      }
                    >
                      {t(`admin.inventory.${unit.status.toLowerCase()}`)}
                    </span>
                    {unit.reservedUntil ? (
                      <p className="mt-1 text-[10px] text-muted">
                        {t("admin.orderDetail.reservationUntil")}: {date(unit.reservedUntil)}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <span className="text-xs ltr-value" dir="ltr">
                      {unit.activationCode
                        ? canSeeCodes
                          ? unit.activationCode
                          : masked(unit.activationCode)
                        : t("common.notProvided")}
                    </span>
                    {unit.activationCode && !canSeeCodes ? (
                      <p className="text-[10px] text-muted">{t("admin.orderDetail.maskedCode")}</p>
                    ) : null}
                  </td>
                  <td>
                    {unit.qrPath && canSeeCodes ? (
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
                  <td>
                    {unit.order ? (
                      <Link
                        href={`/${locale}/admin/orders/${unit.order.id}`}
                        className="link text-xs font-bold ltr-value"
                        dir="ltr"
                      >
                        {unit.order.reference}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                    {unit.deliveredAt ? (
                      <p className="text-[10px] text-muted">
                        {t("admin.orderDetail.deliveredAt")}: {date(unit.deliveredAt)}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {canManage && unit.status === "RESERVED" ? (
                        <ConfirmForm action={releaseInventoryAction} message={t("admin.inventory.release")}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={unit.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/inventory`} />
                          <button type="submit" className="btn btn-secondary btn-sm">
                            {t("admin.inventory.release")}
                          </button>
                        </ConfirmForm>
                      ) : null}
                      {canManage && (unit.status === "AVAILABLE" || unit.status === "RESERVED") && !unit.deliveredAt ? (
                        <ConfirmForm action={revokeInventoryAction} message={t("admin.inventory.deleteConfirm")}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={unit.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/inventory`} />
                          <button type="submit" className="btn btn-danger btn-sm">
                            {t("admin.inventory.revoke")}
                          </button>
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
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
