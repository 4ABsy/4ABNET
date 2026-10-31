import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getCategoryBySlug, listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";
import { GridIcon } from "@/components/icons";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const category = await getCategoryBySlug(slug, locale);
  return { title: category?.name ?? "Category", description: category?.description };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);

  const category = await getCategoryBySlug(slug, locale);
  if (!category || !category.isVisible) notFound();

  const products = await listProducts({ locale, categoryId: category.id });

  return (
    <div className="container-page mt-8">
      <nav className="text-xs text-muted" aria-label={t("common.home")}>
        <Link href={`/${locale}`} className="hover:text-brand-ink">{t("common.home")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <Link href={`/${locale}/products`} className="hover:text-brand-ink">{t("nav.products")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-white">
        <div className="grid gap-0 sm:grid-cols-[240px_1fr]">
          <div className="relative aspect-[16/9] bg-brand-soft sm:aspect-auto">
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-40 items-center justify-center text-brand-ink">
                <GridIcon size={40} />
              </div>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{category.name}</h1>
            {category.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{category.description}</p>
            ) : null}
            <p className="mt-4 text-xs font-semibold text-muted">
              {t("admin.categories.productsCount", { count: products.length })}
            </p>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("home.noCategoryProducts")}
            actionHref={`/${locale}/products`}
            actionLabel={t("common.allProducts")}
            icon={<GridIcon size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
