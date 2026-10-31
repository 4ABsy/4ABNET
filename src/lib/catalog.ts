import "server-only";
import { cache } from "react";
import type { Category, CategoryTranslation, Product, ProductTranslation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/constants";
import { parseJsonArray } from "@/lib/json";
import { textContains } from "@/lib/db-search";
import { cachedRead } from "@/lib/store-cache";
import { localizedValue } from "@/lib/settings";

export type TranslationRow = { locale: string; name: string; description?: string | null; shortDescription?: string | null };

/**
 * Choose the best translation: requested locale → Arabic → English → Turkish → any.
 * This is the documented fallback policy used across the storefront.
 */
export function pickTranslation<T extends { locale: string }>(
  rows: T[],
  locale: Locale,
): T | null {
  if (!rows.length) return null;
  const order: string[] = [locale, "ar", "en", "tr"];
  for (const code of order) {
    const match = rows.find((r) => r.locale === code);
    if (match) return match;
  }
  return rows[0] ?? null;
}

export type ProductWithTranslations = Product & { translations: ProductTranslation[] };
export type CategoryWithTranslations = Category & { translations: CategoryTranslation[] };

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  imageUrl: string | null;
  gallery: string[];
  priceMinor: number;
  originalPriceMinor: number | null;
  currency: string;
  dataAllowance: string | null;
  validityDays: number | null;
  network: string | null;
  countries: string[];
  activationNotes: string | null;
  isFeatured: boolean;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  available: number;
  /** True when at least one localized field is missing in the active language. */
  missingTranslation: boolean;
};

export function toProductView(
  product: ProductWithTranslations & { category?: CategoryWithTranslations | null },
  locale: Locale,
  stock: number,
): ProductView {
  const translation = pickTranslation(product.translations, locale);
  const categoryTranslation = product.category ? pickTranslation(product.category.translations, locale) : null;
  return {
    id: product.id,
    slug: product.slug,
    name: translation?.name ?? product.slug,
    shortDescription: translation?.shortDescription ?? "",
    description: translation?.description ?? "",
    imageUrl: product.imageUrl,
    gallery: parseJsonArray(product.galleryJson),
    priceMinor: product.priceMinor,
    originalPriceMinor:
      product.originalPriceMinor && product.originalPriceMinor > product.priceMinor
        ? product.originalPriceMinor
        : null,
    currency: product.currency,
    dataAllowance: product.dataAllowance,
    validityDays: product.validityDays,
    network: product.network,
    countries: parseJsonArray(product.countriesJson),
    activationNotes: product.activationNotes,
    isFeatured: product.isFeatured,
    categoryId: product.categoryId,
    categoryName: categoryTranslation?.name ?? "",
    categorySlug: product.category?.slug ?? "",
    available: stock,
    missingTranslation: !translation || translation.locale !== locale,
  };
}

export const getStockCounts = cache(async (productIds: string[]): Promise<Record<string, number>> => {
  if (!productIds.length) return {};
  const rows = await prisma.inventoryUnit.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, status: "AVAILABLE" },
    _count: { _all: true },
  });
  const result: Record<string, number> = {};
  for (const row of rows) result[row.productId] = row._count._all;
  return result;
});

/** Cached per request: the storefront layout and pages both need this list. */
export const getVisibleCategories = cache(async (locale: Locale) => {
  return cachedRead(`store:categories:${locale}`, async () => {
    const categories = await prisma.category.findMany({
      where: { isVisible: true, isArchived: false },
      include: { translations: true, _count: { select: { products: { where: { isActive: true, isArchived: false } } } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return categories.map((category) => {
      const t = pickTranslation(category.translations, locale);
      return {
        id: category.id,
        slug: category.slug,
        name: t?.name ?? category.slug,
        description: t?.description ?? "",
        imageUrl: category.imageUrl,
        productCount: category._count.products,
        missingTranslation: !t || t.locale !== locale,
      };
    });
  });
});

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const category = await prisma.category.findFirst({
    where: { slug, isArchived: false },
    include: { translations: true },
  });
  if (!category) return null;
  const t = pickTranslation(category.translations, locale);
  return {
    id: category.id,
    slug: category.slug,
    name: t?.name ?? category.slug,
    description: t?.description ?? "",
    imageUrl: category.imageUrl,
    isVisible: category.isVisible,
    missingTranslation: !t || t.locale !== locale,
  };
}

const PRODUCT_INCLUDE = {
  translations: true,
  category: { include: { translations: true } },
} as const;

export async function listProducts(options: {
  locale: Locale;
  categoryId?: string;
  featuredOnly?: boolean;
  limit?: number;
  skip?: number;
  query?: string;
  includeOutOfStock?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "default";
}): Promise<ProductView[]> {
  const cacheKey = `store:products:${options.locale}:${JSON.stringify([
    options.categoryId ?? "",
    options.featuredOnly ?? false,
    options.limit ?? null,
    options.skip ?? null,
    options.query ?? "",
    options.includeOutOfStock ?? false,
    options.sort ?? "default",
  ])}`;
  return cachedRead(cacheKey, () => loadProducts(options));
}

async function loadProducts(options: {
  locale: Locale;
  categoryId?: string;
  featuredOnly?: boolean;
  limit?: number;
  skip?: number;
  query?: string;
  includeOutOfStock?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "default";
}): Promise<ProductView[]> {
  const { locale, categoryId, featuredOnly, limit = 100, skip = 0, query, sort } = options;
  const where: Record<string, unknown> = { isActive: true, isArchived: false };
  if (categoryId) where.categoryId = categoryId;
  if (featuredOnly) where.isFeatured = true;
  if (query && query.trim().length >= 2) {
    const match = textContains(query);
    where.OR = [
      { slug: match },
      { sku: match },
      { translations: { some: { name: match } } },
      { translations: { some: { shortDescription: match } } },
      { translations: { some: { description: match } } },
    ];
  }
  const orderBy =
    sort === "price_asc"
      ? [{ priceMinor: "asc" as const }]
      : sort === "price_desc"
        ? [{ priceMinor: "desc" as const }]
        : sort === "newest"
          ? [{ createdAt: "desc" as const }]
          : [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];
  const [products, stocks] = await Promise.all([
    prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy,
      take: limit,
      skip,
    }),
    getStockCounts([]),
  ]);
  const productIds = products.map((p) => p.id);
  const stockMap = productIds.length ? await getStockCounts(productIds) : {};
  return products.map((p) => toProductView(p, locale, stockMap[p.id] ?? 0));
}

export async function countActiveProducts(options: {
  categoryId?: string;
  query?: string;
}): Promise<number> {
  const where: Record<string, unknown> = { isActive: true, isArchived: false };
  if (options.categoryId) where.categoryId = options.categoryId;
  if (options.query && options.query.trim().length >= 2) {
    const match = textContains(options.query);
    where.OR = [
      { slug: match },
      { sku: match },
      { translations: { some: { name: match } } },
      { translations: { some: { shortDescription: match } } },
      { translations: { some: { description: match } } },
    ];
  }
  return prisma.product.count({ where });
}

export async function getProductBySlug(slug: string, locale: Locale) {
  const product = await prisma.product.findFirst({
    where: { slug, isArchived: false },
    include: {
      ...PRODUCT_INCLUDE,
      relatedFrom: { include: { related: { include: PRODUCT_INCLUDE } }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) return null;
  const stocks = await getStockCounts([product.id, ...product.relatedFrom.map((r) => r.relatedId)]);
  const view = toProductView(product, locale, stocks[product.id] ?? 0);
  const related = product.relatedFrom
    .filter((r) => r.related.isActive && !r.related.isArchived)
    .map((r) => toProductView(r.related, locale, stocks[r.relatedId] ?? 0));
  return { ...view, related };
}

export async function getActiveBanners(locale: Locale) {
  return cachedRead(`store:banners:${locale}`, async () => {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isVisible: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: { translations: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return banners.map((banner) => {
      const t = pickTranslation(banner.translations, locale);
      return {
        id: banner.id,
        title: t?.title ?? "",
        subtitle: t?.subtitle ?? "",
        ctaLabel: t?.ctaLabel ?? "",
        imageUrl: banner.imageUrl,
        linkType: banner.linkType,
        linkValue: banner.linkValue,
      };
    });
  });
}

/** Resolve a banner link into a safe internal path. External URLs must be http(s). */
export function bannerHref(banner: { linkType: string; linkValue: string | null }, locale: Locale): string | null {
  if (!banner.linkValue) return null;
  if (banner.linkType === "CATEGORY") return `/${locale}/categories/${encodeURIComponent(banner.linkValue)}`;
  if (banner.linkType === "PRODUCT") return `/${locale}/products/${encodeURIComponent(banner.linkValue)}`;
  if (banner.linkType === "URL") {
    try {
      const url = new URL(banner.linkValue);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      return null;
    }
  }
  return null;
}
