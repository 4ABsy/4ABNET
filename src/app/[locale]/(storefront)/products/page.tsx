import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getVisibleCategories, listProducts, countActiveProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { WifiIcon } from "@/components/icons";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("nav.products"), description: t("home.productsSubtitle") };
}

const PAGE_SIZE = 12;

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const query = await searchParams;

  const categorySlug = typeof query.category === "string" ? query.category : "";
  const sortRaw = typeof query.sort === "string" ? query.sort : "default";
  const sort = ["price_asc", "price_desc", "newest"].includes(sortRaw)
    ? (sortRaw as "price_asc" | "price_desc" | "newest")
    : "default";
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : "1") || 1);

  const categories = await getVisibleCategories(locale);
  const activeCategory = categories.find((category) => category.slug === categorySlug);

  const [products, total] = await Promise.all([
    listProducts({
      locale,
      categoryId: activeCategory?.id,
      sort,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    activeCategory?.id
      ? countActiveProducts({ categoryId: activeCategory.id, query: categorySlug || undefined })
      : countActiveProducts({ query: categorySlug || undefined }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page;

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (sort !== "default") params.set("sort", sort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const suffix = params.toString();
    return `/${locale}/products${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="container-page mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">
            {activeCategory ? activeCategory.name : t("nav.products")}
          </h1>
          {activeCategory?.description ? (
            <p className="section-subtitle">{activeCategory.description}</p>
          ) : (
            <p className="section-subtitle">{t("home.productsSubtitle")}</p>
          )}
        </div>
        <p className="text-sm font-semibold text-muted">
          {t("product.resultsCount", { count: total })}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/${locale}/products${sort !== "default" ? `?sort=${sort}` : ""}`}
          className={`badge ${
            !activeCategory ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:bg-brand-soft"
          }`}
        >
          {t("common.all")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/${locale}/products?category=${encodeURIComponent(category.slug)}${
              sort !== "default" ? `&sort=${sort}` : ""
            }`}
            className={`badge ${
              activeCategory?.id === category.id
                ? "bg-ink text-white"
                : "bg-white text-ink-soft ring-1 ring-line hover:bg-brand-soft"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-3">
        {categorySlug ? <input type="hidden" name="category" value={categorySlug} /> : null}
        <div className="min-w-40">
          <label htmlFor="sort" className="label text-xs">{t("common.filter")}</label>
          <select id="sort" name="sort" defaultValue={sort} className="input">
            <option value="default">{t("common.all")}</option>
            <option value="newest">{t("common.created")}</option>
            <option value="price_asc">{t("common.price")} ↑</option>
            <option value="price_desc">{t("common.price")} ↓</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">{t("common.apply")}</button>
        <Link href={`/${locale}/products`} className="btn btn-ghost">{t("common.reset")}</Link>
      </form>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("home.emptyCatalog")}
            body={t("home.noCategoryProducts")}
            actionHref={`/${locale}/products`}
            actionLabel={t("common.allProducts")}
            icon={<WifiIcon size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label={t("common.page")}>
          {currentPage > 1 ? (
            <Link href={pageHref(currentPage - 1)} className="btn btn-secondary btn-sm">
              {t("common.previous")}
            </Link>
          ) : null}
          <span className="px-3 text-sm text-muted">
            {t("common.page")} {currentPage} {t("common.of")} {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link href={pageHref(currentPage + 1)} className="btn btn-secondary btn-sm">
              {t("common.next")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
