"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart, useI18n } from "@/components/providers";
import {
  CartIcon,
  ChevronDownIcon,
  GlobeIcon,
  MenuIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/constants";

type CategoryLink = { slug: string; name: string };

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `4ab_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    const replaced = pathname
      ? pathname.replace(/^\/(ar|en|tr)(?=\/|$)/, `/${next}`)
      : `/${next}`;
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`${replaced || `/${next}`}${search}`);
  }

  return (
    <details className="group relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-2 text-sm font-semibold text-ink-soft hover:bg-brand-soft [&::-webkit-details-marker]:hidden ${
          compact ? "justify-center" : ""
        }`}
        aria-label={t("common.language")}
      >
        <GlobeIcon size={18} />
        <span className={compact ? "sr-only" : "hidden sm:inline"}>{LOCALE_NAMES[locale]}</span>
        <ChevronDownIcon size={14} />
      </summary>
      <ul className="absolute end-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
        {LOCALES.map((code) => (
          <li key={code}>
            <button
              type="button"
              onClick={() => switchTo(code)}
              lang={code}
              className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-brand-soft ${
                code === locale ? "font-bold text-brand-ink" : "text-ink"
              }`}
            >
              {LOCALE_NAMES[code]}
              {code === locale ? <span aria-hidden="true">✓</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CartButton() {
  const { locale, t } = useI18n();
  const { count, hydrated } = useCart();
  return (
    <Link
      href={`/${locale}/cart`}
      className="relative rounded-xl p-2.5 text-ink hover:bg-brand-soft"
      aria-label={t("nav.cart")}
    >
      <CartIcon size={22} />
      {hydrated && count > 0 ? (
        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-ink ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeader({
  logoUrl,
  storeName,
  tagline,
  categories,
}: {
  logoUrl: string;
  storeName: string;
  tagline: string;
  categories: CategoryLink[];
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = [
    { href: `/${locale}`, label: t("nav.home") },
    { href: `/${locale}/products`, label: t("nav.products") },
    { href: `/${locale}#offers`, label: t("nav.offers") },
    { href: `/${locale}/track`, label: t("nav.track") },
    { href: `/${locale}/support`, label: t("nav.support") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl p-2 text-ink hover:bg-brand-soft lg:hidden"
          aria-label={t("nav.menu")}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <MenuIcon size={24} />
        </button>

        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight text-ink">{storeName}</span>
            <span className="hidden text-[11px] font-medium text-muted sm:block">{tagline}</span>
          </span>
        </Link>

        <form
          action={`/${locale}/search`}
          method="get"
          role="search"
          className="hidden flex-1 justify-center md:flex"
        >
          <div className="relative w-full max-w-xl">
            <label htmlFor="header-search" className="sr-only">
              {t("nav.searchLabel")}
            </label>
            <input
              id="header-search"
              type="search"
              name="q"
              minLength={2}
              maxLength={80}
              placeholder={t("product.searchPlaceholder")}
              className="input h-11 ps-11"
            />
            <span className="pointer-events-none absolute inset-y-0 start-0 flex w-11 items-center justify-center text-muted">
              <SearchIcon size={18} />
            </span>
            <button
              type="submit"
              className="btn btn-primary btn-sm absolute end-1.5 top-1.5 h-8"
            >
              {t("common.search")}
            </button>
          </div>
        </form>

        <div className="ms-auto flex items-center gap-1">
          <Link
            href={`/${locale}/track`}
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-brand-soft xl:block"
          >
            {t("nav.track")}
          </Link>
          <LanguageSwitcher />
          <CartButton />
        </div>
      </div>

      <form action={`/${locale}/search`} method="get" role="search" className="container-page pb-3 md:hidden">
        <div className="relative">
          <label htmlFor="mobile-search" className="sr-only">
            {t("nav.searchLabel")}
          </label>
          <input
            id="mobile-search"
            type="search"
            name="q"
            minLength={2}
            maxLength={80}
            placeholder={t("product.searchPlaceholder")}
            className="input h-11 ps-10"
          />
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-10 items-center justify-center text-muted">
            <SearchIcon size={18} />
          </span>
        </div>
      </form>

      <nav aria-label={t("nav.menu")} className="hidden border-t border-line/70 lg:block">
        <div className="container-page flex items-center gap-1 overflow-x-auto py-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link whitespace-nowrap">
              {item.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
          {categories.slice(0, 6).map((category) => (
            <Link
              key={category.slug}
              href={`/${locale}/categories/${category.slug}`}
              className="nav-link whitespace-nowrap text-muted"
            >
              {category.name}
            </Link>
          ))}
          <Link
            href={`/${locale}/products`}
            className="nav-link ms-auto whitespace-nowrap text-brand-ink"
          >
            {t("common.allProducts")} →
          </Link>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-navigation"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <span className="text-lg font-extrabold">{storeName}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 hover:bg-brand-soft"
                aria-label={t("common.close")}
              >
                <XIcon size={22} />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-4">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-brand-soft"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted">
                {t("nav.categories")}
              </p>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/${locale}/categories/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-brand-soft"
                >
                  {category.name}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              <Link
                href={`/${locale}/cart`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-brand-soft"
              >
                {t("cart.title")}
              </Link>
              <Link
                href={`/${locale}/privacy`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-brand-soft"
              >
                {t("nav.privacy")}
              </Link>
              <Link
                href={`/${locale}/terms`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-brand-soft"
              >
                {t("nav.terms")}
              </Link>
              <Link
                href={`/${locale}/refund`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-brand-soft"
              >
                {t("nav.refund")}
              </Link>
              <div className="my-2 border-t border-line" />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
