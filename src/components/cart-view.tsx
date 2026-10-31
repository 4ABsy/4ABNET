"use client";

import Link from "next/link";
import { useCart, useI18n } from "@/components/providers";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

export function CartView() {
  const { locale, t, money } = useI18n();
  const { items, hydrated, setQuantity, remove, clear, totalMinor, count } = useCart();

  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-3">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title={t("cart.empty")}
        body={t("cart.emptyBody")}
        actionHref={`/${locale}/products`}
        actionLabel={t("common.allProducts")}
        icon={<span className="text-xl font-extrabold">4AB</span>}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.productId} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
            <Link
              href={`/${locale}/products/${item.slug}`}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-soft sm:h-24 sm:w-24"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs font-extrabold text-brand-ink">4AB</span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/${locale}/products/${item.slug}`} className="line-clamp-2 text-sm font-bold hover:text-brand-ink sm:text-base">
                  {item.name}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={`${t("cart.remove")} ${item.name}`}
                >
                  <TrashIcon size={17} />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                {money(item.priceMinor)} <span className="mx-1">·</span> {t("common.perUnit")}
              </p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="inline-flex items-center rounded-lg border border-line bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-2 disabled:opacity-40"
                    aria-label={t("common.previous")}
                  >
                    <MinusIcon size={14} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= Math.min(item.maxQty || 10, 10)}
                    className="p-2 disabled:opacity-40"
                    aria-label={t("common.next")}
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
                <p className="text-sm font-extrabold">{money(item.priceMinor * item.quantity)}</p>
              </div>
              {item.maxQty && item.quantity >= item.maxQty ? (
                <p className="mt-1 text-[11px] text-warning">{t("cart.maxStock")}</p>
              ) : null}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href={`/${locale}/products`} className="link text-sm font-semibold">
            ← {t("cart.continueShopping")}
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("cart.clearConfirm"))) clear();
            }}
            className="text-xs font-semibold text-danger underline-offset-4 hover:underline"
          >
            {t("cart.clear")}
          </button>
        </div>
      </div>

      <aside className="card sticky top-24 p-5">
        <h2 className="text-lg font-bold text-ink">{t("cart.summary")}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">{t("common.subtotal")}</dt>
            <dd className="font-semibold">{money(totalMinor)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">{t("common.quantity")}</dt>
            <dd className="font-semibold">{t("cart.itemsCount", { count })}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-base">
            <dt className="font-bold">{t("common.total")}</dt>
            <dd className="font-extrabold text-brand-ink">{money(totalMinor)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-5 text-muted">{t("order.currencyNote")}</p>
        <p className="mt-2 text-xs leading-6 text-muted">{t("cart.digitalNote")}</p>
        <Link href={`/${locale}/checkout`} className="btn btn-primary mt-5 w-full">
          {t("cart.checkout")}
        </Link>
        <p className="mt-3 text-center text-[11px] text-muted">{t("checkout.reviewNote")}</p>
      </aside>
    </div>
  );
}
