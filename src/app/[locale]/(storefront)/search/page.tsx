import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("product.resultsTitle"), robots: { index: false, follow: true } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const query = await searchParams;
  const raw = typeof query.q === "string" ? query.q : "";
  const q = raw.trim().slice(0, 80);

  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let failed = false;
  if (q.length >= 2) {
    try {
      products = await listProducts({ locale, query: q, limit: 48 });
    } catch {
      failed = true;
    }
  }

  return (
    <div className="container-page mt-8">
      <h1 className="section-title">{t("product.resultsTitle")}</h1>
      <form method="get" role="search" className="mt-4 flex max-w-2xl gap-2">
        <div className="relative flex-1">
          <label htmlFor="search-q" className="sr-only">{t("nav.searchLabel")}</label>
          <input
            id="search-q"
            type="search"
            name="q"
            defaultValue={q}
            minLength={2}
            maxLength={80}
            placeholder={t("product.searchPlaceholder")}
            className="input h-12 ps-11"
            autoFocus
          />
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-11 items-center justify-center text-muted">
            <SearchIcon size={18} />
          </span>
        </div>
        <button type="submit" className="btn btn-primary h-12">{t("common.search")}</button>
      </form>

      {q.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("product.searchPlaceholder")}</p>
      ) : q.length < 2 ? (
        <p className="mt-6 text-sm text-warning">{t("product.searchTooShort")}</p>
      ) : failed ? (
        <div className="mt-6 rounded-2xl border border-danger/20 bg-danger-soft p-4 text-sm font-semibold text-danger">
          {t("product.searchError")}
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm font-semibold text-muted">
            {t("product.resultsCount", { count: products.length })} · “{q}”
          </p>
          {products.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={t("product.searchEmptyTitle")}
                body={t("product.searchEmptyBody")}
                actionHref={`/${locale}/products`}
                actionLabel={t("common.allProducts")}
                icon={<SearchIcon size={26} />}
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <Link href={`/${locale}/products`} className="link text-sm font-semibold">
          {t("common.allProducts")} →
        </Link>
      </div>
    </div>
  );
}
