import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getProductBySlug } from "@/lib/catalog";
import { discountPercent } from "@/lib/money";
import { ProductCard } from "@/components/product-card";
import { ProductGallery, ProductPurchase } from "@/components/product-details";
import { CheckIcon, QrIcon, ShieldIcon, WifiIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(slug, locale);
  if (!product) return {};
  return {
    title: product.name,
    description: product.shortDescription || product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money, percent } = createI18n(locale);

  const product = await getProductBySlug(slug, locale);
  if (!product) notFound();

  const images = Array.from(new Set([product.imageUrl, ...product.gallery].filter(Boolean))) as string[];
  const discount = discountPercent(product.priceMinor, product.originalPriceMinor);
  const inStock = product.available > 0;
  const savings = product.originalPriceMinor ? product.originalPriceMinor - product.priceMinor : 0;

  const specs: { label: string; value: string | null }[] = [
    { label: t("product.data"), value: product.dataAllowance },
    {
      label: t("product.validity"),
      value: product.validityDays ? t("product.validityDays", { days: product.validityDays }) : null,
    },
    { label: t("product.network"), value: product.network },
    {
      label: t("product.countries"),
      value: product.countries.length ? product.countries.join(" · ") : null,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.shortDescription,
    image: product.imageUrl ? [product.imageUrl] : undefined,
    sku: product.slug,
    offers: {
      "@type": "Offer",
      priceCurrency: "TRY",
      price: (product.priceMinor / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="container-page mt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav className="text-xs text-muted" aria-label={t("common.home")}>
        <Link href={`/${locale}`} className="hover:text-brand-ink">{t("common.home")}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <Link href={`/${locale}/products`} className="hover:text-brand-ink">{t("nav.products")}</Link>
        {product.categoryName ? (
          <>
            <span className="mx-2" aria-hidden="true">/</span>
            <Link href={`/${locale}/categories/${product.categorySlug ?? ""}`} className="hover:text-brand-ink">
              {product.categoryName}
            </Link>
          </>
        ) : null}
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} name={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.categoryName ? <span className="badge-brand">{product.categoryName}</span> : null}
            {discount > 0 ? (
              <span className="badge bg-danger text-white">
                {t("product.discountBadge", { percent: percent(discount / 100) })}
              </span>
            ) : null}
            <span className={inStock ? "badge-success" : "badge-danger"}>
              {inStock ? t("product.inStock") : t("product.outOfStock")}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{product.name}</h1>
          {product.shortDescription ? (
            <p className="mt-3 text-sm leading-7 text-muted">{product.shortDescription}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-ink">{money(product.priceMinor)}</span>
            {product.originalPriceMinor ? (
              <span className="text-base text-muted line-through">{money(product.originalPriceMinor)}</span>
            ) : null}
          </div>
          {savings > 0 ? (
            <p className="mt-1 text-sm font-semibold text-success">
              {t("product.save", { amount: money(savings) })}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted">{t("order.currencyNote")}</p>

          <ProductPurchase
            productId={product.id}
            slug={product.slug}
            name={product.name}
            priceMinor={product.priceMinor}
            imageUrl={product.imageUrl}
            available={product.available}
          />

          <ul className="mt-6 grid gap-2 text-xs text-muted sm:grid-cols-2">
            <li className="flex items-center gap-2"><CheckIcon size={15} className="text-success" /> {t("home.feature1Title")}</li>
            <li className="flex items-center gap-2"><ShieldIcon size={15} className="text-success" /> {t("home.feature4Title")}</li>
            <li className="flex items-center gap-2"><QrIcon size={15} className="text-success" /> {t("home.feature3Title")}</li>
            <li className="flex items-center gap-2"><WifiIcon size={15} className="text-success" /> {t("home.feature2Title")}</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink">{t("product.description")}</h2>
          {product.description ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-8 text-ink-soft">{product.description}</p>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("common.notProvided")}</p>
          )}
          <p className="mt-4 text-xs leading-6 text-muted">{t("product.notProvidedNotice")}</p>
        </section>

        <section className="card p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink">{t("product.specifications")}</h2>
          <p className="mt-1 text-xs text-muted">{t("product.verifiedInfo")}</p>
          <dl className="mt-4 divide-y divide-line text-sm">
            {specs.map((spec) => (
              <div key={spec.label} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <dt className="font-semibold text-ink-soft">{spec.label}</dt>
                <dd className={`max-w-[60%] text-end ${spec.value ? "text-ink" : "text-muted"}`}>
                  {spec.value ? <bdi className={/^\d/.test(spec.value) ? "ltr-value" : ""}>{spec.value}</bdi> : t("common.notProvided")}
                </dd>
              </div>
            ))}
          </dl>

          {product.activationNotes ? (
            <div className="mt-5 rounded-xl bg-brand-soft p-4">
              <h3 className="text-sm font-bold text-brand-ink">{t("product.activationNotes")}</h3>
              <p className="mt-2 whitespace-pre-line text-xs leading-6 text-ink-soft">{product.activationNotes}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-page p-3 text-xs leading-6 text-muted">
              {t("product.activation")}: {t("common.notProvided")}
            </p>
          )}
        </section>
      </div>

      {product.related.length > 0 ? (
        <section className="mt-12">
          <h2 className="section-title">{t("product.related")}</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {product.related.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
