import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { textContains } from "@/lib/db-search";
import { pickTranslation } from "@/lib/catalog";
import { getStockCounts } from "@/lib/catalog";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import {
  deleteProductAction,
  toggleProductArchiveAction,
} from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Search = {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
  ok?: string;
  error?: string;
};

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "products.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const q = single(query.q).trim();
  const category = single(query.category);
  const status = single(query.status);
  const page = Math.max(1, Number.parseInt(single(query.page), 10) || 1);

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    const match = textContains(q);
    where.OR = [
      { slug: match },
      { sku: match },
      { translations: { some: { name: match } } },
    ];
  }
  if (category) where.categoryId = category;
  if (status === "archived") where.isArchived = true;
  else if (status === "active") {
    where.isArchived = false;
    where.isActive = true;
  } else if (status === "inactive") {
    where.isArchived = false;
    where.isActive = false;
  }

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        translations: true,
        category: { include: { translations: true } },
        _count: { select: { inventory: true } },
      },
      orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.category.findMany({
      where: { isArchived: false },
      include: { translations: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const stocks = await getStockCounts(products.map((product) => product.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (category) baseParams.set("category", category);
  if (status) baseParams.set("status", status);
  const pageHref = (target: number) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(target));
    return `/${locale}/admin/products?${params.toString()}`;
  };

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.products.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("product.resultsCount", { count: total })}</p>
        </div>
        <Link href={`/${locale}/admin/products/new`} className="btn btn-primary btn-sm">
          + {t("admin.products.add")}
        </Link>
      </div>

      <form method="get" className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="product-q" className="label">{t("common.search")}</label>
          <input
            id="product-q"
            name="q"
            defaultValue={q}
            placeholder={t("admin.products.name")}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="product-category" className="label">{t("admin.products.category")}</label>
          <select id="product-category" name="category" defaultValue={category} className="input">
            <option value="">{t("common.all")}</option>
            {categories.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {pickTranslation(entry.translations, locale)?.name ?? entry.slug}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product-status" className="label">{t("common.status")}</label>
          <select id="product-status" name="status" defaultValue={status} className="input">
            <option value="">{t("common.all")}</option>
            <option value="active">{t("admin.products.active")}</option>
            <option value="inactive">{t("common.inactive")}</option>
            <option value="archived">{t("admin.products.archived")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-secondary btn-sm">{t("common.filter")}</button>
          <Link href={`/${locale}/admin/products`} className="btn btn-ghost btn-sm">{t("common.reset")}</Link>
        </div>
      </form>

      {products.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.products.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.products.name")}</th>
                <th>{t("admin.products.category")}</th>
                <th>{t("admin.products.price")}</th>
                <th>{t("admin.products.stock")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const translation = pickTranslation(product.translations, locale);
                const categoryName =
                  pickTranslation(product.category.translations, locale)?.name ?? product.category.slug;
                const missing = (["ar", "en", "tr"] as const).some(
                  (code) => !product.translations.some((entry) => entry.locale === code),
                );
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-start gap-2">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-page text-[10px] text-muted">
                            4AB
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">{translation?.name ?? product.slug}</p>
                          <p className="text-[11px] text-muted ltr-value" dir="ltr">{product.slug}</p>
                          {product.isFeatured ? (
                            <span className="badge badge-brand mt-1">{t("admin.products.featured")}</span>
                          ) : null}
                          {missing ? (
                            <span className="badge badge-warning mt-1">{t("admin.products.missingTranslations")}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{categoryName}</td>
                    <td className="font-bold">{money(product.priceMinor)}</td>
                    <td>
                      <span className={stocks[product.id] ? "font-bold text-success" : "font-bold text-danger"}>
                        {stocks[product.id] ?? 0}
                      </span>
                      <p className="text-[11px] text-muted">
                        {t("admin.inventory.availableCount", { count: stocks[product.id] ?? 0 })}
                      </p>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={product.isArchived ? "badge badge-neutral" : product.isActive ? "badge badge-success" : "badge badge-warning"}>
                          {product.isArchived
                            ? t("admin.products.archived")
                            : product.isActive
                              ? t("admin.products.active")
                              : t("common.inactive")}
                        </span>
                        <span className="text-[11px] text-muted">
                          {t("admin.products.stock")}: {product._count.inventory}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/${locale}/admin/products/${product.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          {t("common.edit")}
                        </Link>
                        <form action={toggleProductArchiveAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={product.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/products`} />
                          <button type="submit" className="btn btn-ghost btn-sm">
                            {product.isArchived ? t("admin.products.restore") : t("admin.products.archive")}
                          </button>
                        </form>
                        {product._count.inventory === 0 ? (
                          <ConfirmForm
                            action={deleteProductAction}
                            message={t("admin.products.deleteConfirm")}
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={product.id} />
                            <input type="hidden" name="returnTo" value={`/${locale}/admin/products`} />
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
