import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { CartView } from "@/components/cart-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = createI18n(locale);
  return { title: t("cart.title"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const { t } = createI18n(rawLocale);

  return (
    <div className="container-page mt-8">
      <h1 className="section-title">{t("cart.title")}</h1>
      <div className="mt-6">
        <CartView />
      </div>
    </div>
  );
}
