"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, useI18n } from "@/components/providers";
import { CartIcon, MinusIcon, PlusIcon } from "@/components/icons";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl border border-line bg-gradient-to-br from-brand-soft to-brand/40 text-4xl font-extrabold text-brand-ink">
        4AB
      </div>
    );
  }
  const activeImage = images[Math.min(active, images.length - 1)];
  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={activeImage} alt={name} className="aspect-square w-full object-cover" />
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${name} ${index + 1}`}
              aria-current={index === active}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                index === active ? "border-brand" : "border-line hover:border-brand/50"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductPurchase({
  productId,
  slug,
  name,
  priceMinor,
  imageUrl,
  available,
}: {
  productId: string;
  slug: string;
  name: string;
  priceMinor: number;
  imageUrl: string | null;
  available: number;
}) {
  const { locale, t } = useI18n();
  const { add } = useCart();
  const router = useRouter();
  const max = Math.min(Math.max(available, 1), 10);
  const [quantity, setQuantity] = useState(1);
  const inStock = available > 0;

  function cartItem() {
    return {
      productId,
      slug,
      name,
      priceMinor,
      imageUrl,
      maxQty: max,
    };
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <span className="label">{t("product.quantity")}</span>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-line bg-white">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={!inStock || quantity <= 1}
              className="p-3 text-ink disabled:opacity-40"
              aria-label={t("common.previous")}
            >
              <MinusIcon size={16} />
            </button>
            <span className="min-w-10 text-center text-sm font-bold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(max, value + 1))}
              disabled={!inStock || quantity >= max}
              className="p-3 text-ink disabled:opacity-40"
              aria-label={t("common.next")}
            >
              <PlusIcon size={16} />
            </button>
          </div>
          <p className="text-xs text-muted">{t("product.quantityHint")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!inStock}
          onClick={() => add(cartItem(), quantity)}
          className="btn btn-primary h-12"
        >
          <CartIcon size={18} />
          {inStock ? t("product.addToCart") : t("product.outOfStock")}
        </button>
        <button
          type="button"
          disabled={!inStock}
          onClick={() => {
            add(cartItem(), quantity);
            router.push(`/${locale}/checkout`);
          }}
          className="btn btn-secondary h-12"
        >
          {t("product.buyNow")}
        </button>
      </div>
    </div>
  );
}
