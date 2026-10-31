import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getSettings, settingBool, settingString } from "@/lib/settings";
import { getActiveBanners, bannerHref, getVisibleCategories, listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { BannerCarousel } from "@/components/banner-carousel";
import { EmptyState } from "@/components/empty-state";
import { BoltIcon, CheckIcon, QrIcon, ShieldIcon, WifiIcon, HeadsetIcon, GridIcon } from "@/components/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  // `absolute` keeps the brand from being appended twice by the root template.
  return {
    title: { absolute: `${t("common.brand")} — ${t("common.tagline")}` },
    description: t("footer.aboutBody"),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, money } = createI18n(locale);

  const [settings, categories, banners, products] = await Promise.all([
    getSettings(),
    getVisibleCategories(locale),
    getActiveBanners(locale),
    listProducts({ locale }),
  ]);

  const heroTitle = settingString(settings, SETTING_KEYS.heroTitle, locale);
  const heroSubtitle = settingString(settings, SETTING_KEYS.heroSubtitle, locale);
  const showCategories = settingBool(settings, SETTING_KEYS.showCategories);
  const showFeatures = settingBool(settings, SETTING_KEYS.showFeatures);
  const showOffers = settingBool(settings, SETTING_KEYS.showOffers);
  const showFeatured = settingBool(settings, SETTING_KEYS.showFeatured);

  const featured = products.filter((product) => product.isFeatured).slice(0, 4);
  const offers = products
    .filter((product) => product.originalPriceMinor && product.originalPriceMinor > product.priceMinor)
    .slice(0, 4);

  const grouped = categories
    .map((category) => ({
      category,
      items: products.filter((product) => product.categoryId === category.id).slice(0, 4),
    }))
    .filter((group) => group.items.length > 0);

  const carouselBanners = banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    ctaLabel: banner.ctaLabel,
    imageUrl: banner.imageUrl,
    href: bannerHref(banner, locale),
  }));

  return (
    <div className="pb-6">
      <section className="container-page mt-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink text-white">
          <div className="absolute -end-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-32 start-1/4 h-80 w-80 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:p-14">
            <div>
              <span className="badge bg-brand/15 text-brand ring-1 ring-brand/30">
                <BoltIcon size={14} /> {t("home.heroBadge")}
              </span>
              <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {heroTitle || t("common.tagline")}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base">{heroSubtitle}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/${locale}/products`} className="btn btn-primary">
                  {t("home.heroCta")}
                </Link>
                <Link
                  href={`/${locale}/track`}
                  className="btn border-white/25 bg-white/10 text-white hover:bg-white/20"
                >
                  {t("home.heroSecondary")}
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/70">
                <li className="inline-flex items-center gap-1.5"><CheckIcon size={15} className="text-brand" /> {t("home.feature1Title")}</li>
                <li className="inline-flex items-center gap-1.5"><CheckIcon size={15} className="text-brand" /> {t("home.feature4Title")}</li>
                <li className="inline-flex items-center gap-1.5"><CheckIcon size={15} className="text-brand" /> {t("common.currency")}</li>
              </ul>
            </div>
            <div className="relative hidden justify-center lg:flex" aria-hidden="true">
              <div className="relative w-64 rotate-3 rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">eSIM</span>
                  <WifiIcon size={22} className="text-brand" />
                </div>
                <p className="mt-6 text-2xl font-extrabold">4AB NET</p>
                <p className="mt-1 text-xs text-white/70">{t("common.tagline")}</p>
                <div className="mt-8 space-y-2">
                  <div className="h-2 w-3/4 rounded-full bg-white/30" />
                  <div className="h-2 w-1/2 rounded-full bg-white/20" />
                </div>
                <div className="mt-8 flex items-center justify-between rounded-xl bg-brand px-3 py-2 text-ink">
                  <span className="text-xs font-bold">{t("product.data")}</span>
                  <span className="text-sm font-extrabold">{products[0]?.dataAllowance ?? "GB"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-white/60">
                  <span>{t("order.currencyNote")}</span>
                  <QrIcon size={18} className="text-white/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BannerCarousel banners={carouselBanners} />

      {showCategories && categories.length > 0 ? (
        <section className="container-page mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">{t("home.categoriesTitle")}</h2>
              <p className="section-subtitle">{t("home.categoriesSubtitle")}</p>
            </div>
            <Link href={`/${locale}/products`} className="link text-sm font-semibold">
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/categories/${category.slug}`}
                className="card group relative flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[16/10] bg-brand-soft">
                  {category.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-brand-ink">
                      <GridIcon size={34} />
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="text-sm font-bold text-ink group-hover:text-brand-ink">{category.name}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {t("admin.categories.productsCount", { count: category.productCount })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showFeatured && featured.length > 0 ? (
        <section className="container-page mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">{t("home.featuredTitle")}</h2>
              <p className="section-subtitle">{t("home.featuredSubtitle")}</p>
            </div>
            <Link href={`/${locale}/products`} className="link text-sm font-semibold">
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {showFeatures ? (
        <section className="container-page mt-14">
          <h2 className="section-title">{t("home.featuresTitle")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <BoltIcon size={22} />, title: t("home.feature1Title"), body: t("home.feature1Body") },
              { icon: <QrIcon size={22} />, title: t("home.feature2Title"), body: t("home.feature2Body") },
              { icon: <ShieldIcon size={22} />, title: t("home.feature3Title"), body: t("home.feature3Body") },
              { icon: <HeadsetIcon size={22} />, title: t("home.feature4Title"), body: t("home.feature4Body") },
            ].map((feature) => (
              <div key={feature.title} className="card p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-sm font-bold text-ink">{feature.title}</h3>
                <p className="mt-2 text-xs leading-6 text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showOffers && offers.length > 0 ? (
        <section id="offers" className="container-page mt-14 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">{t("home.offersTitle")}</h2>
              <p className="section-subtitle">{t("home.offersSubtitle")}</p>
            </div>
            <Link href={`/${locale}/products`} className="link text-sm font-semibold">
              {t("common.viewAll")} →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {products.length === 0 ? (
        <section className="container-page mt-14">
          <EmptyState
            title={t("home.emptyCatalog")}
            actionHref={`/${locale}/products`}
            actionLabel={t("nav.products")}
            icon={<WifiIcon size={26} />}
          />
        </section>
      ) : null}

      {grouped.length > 0 ? (
        <div className="container-page mt-14 space-y-12">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">{t("home.productsTitle")}</h2>
              <p className="section-subtitle">{t("home.productsSubtitle")}</p>
            </div>
          </div>
          {grouped.map(({ category, items }) => (
            <section key={category.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-ink">{category.name}</h3>
                <Link href={`/${locale}/categories/${category.slug}`} className="link text-sm font-semibold">
                  {t("home.viewCategory")} →
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
          <p className="text-center text-xs text-muted">
            {t("order.currencyNote")} · {t("product.verifiedInfo")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
