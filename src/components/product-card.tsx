"use client";

import Link from "next/link";
import { useCart, useI18n } from "@/components/providers";
import { CartIcon } from "@/components/icons";
import { discountPercent } from "@/lib/money";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  imageUrl: string | null;
  priceMinor: number;
  originalPriceMinor: number | null;
  dataAllowance: string | null;
  validityDays: number | null;
  available: number;
  categoryName?: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { locale, t, money, percent } = useI18n();
  const { add } = useCart();
  const discount = discountPercent(product.priceMinor, product.originalPriceMinor);
  const inStock = product.available > 0;
  const href = `/${locale}/products/${product.slug}`;

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-brand-soft">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-brand/40 text-2xl font-extrabold text-brand-ink">
            4AB
          </div>
        )}
        <div className="absolute start-3 top-3 flex flex-col gap-1.5">
          {discount > 0 ? <span className="badge bg-danger text-white">-{percent(discount / 100)}</span> : null}
          {!inStock ? <span className="badge bg-ink text-white">{t("product.outOfStock")}</span> : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.categoryName ? (
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-ink">{product.categoryName}</p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-ink">
          <Link href={href} className="hover:text-brand-ink">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{product.shortDescription}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {product.dataAllowance ? (
            <span>
              {t("product.data")}: <bdi className="ltr-value">{product.dataAllowance}</bdi>
            </span>
          ) : null}
          {product.validityDays ? (
            <span>{t("product.validityDays", { days: product.validityDays })}</span>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-extrabold text-ink">{money(product.priceMinor)}</span>
            {product.originalPriceMinor ? (
              <span className="text-sm text-muted line-through">{money(product.originalPriceMinor)}</span>
            ) : null}
          </div>
          <p className={`mt-0.5 text-xs font-semibold ${inStock ? "text-success" : "text-danger"}`}>
            {inStock
              ? product.available <= 3
                ? t("product.stockRemaining", { count: product.available })
                : t("product.inStock")
              : t("product.outOfStock")}
          </p>

          <button
            type="button"
            disabled={!inStock}
            onClick={() =>
              add(
                {
                  productId: product.id,
                  slug: product.slug,
                  name: product.name,
                  priceMinor: product.priceMinor,
                  imageUrl: product.imageUrl,
                  maxQty: Math.min(Math.max(product.available, 1), 10),
                },
                1,
              )
            }
            className="btn btn-primary mt-3 w-full"
          >
            <CartIcon size={17} />
            {t("product.addToCart")}
          </button>
        </div>
      </div>
    </article>
  );
}
