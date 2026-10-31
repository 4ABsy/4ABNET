import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { Providers } from "@/components/providers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const languages: Record<string, string> = {
    ar: "/ar",
    en: "/en",
    tr: "/tr",
    "x-default": "/ar",
  };
  return {
    alternates: { canonical: `/${locale}`, languages },
    openGraph: {
      locale: locale === "ar" ? "ar_SY" : locale === "tr" ? "tr_TR" : "en_US",
      alternateLocale: Object.keys(languages)
        .filter((key) => key !== "x-default" && key !== locale)
        .map((key) => (key === "ar" ? "ar_SY" : key === "tr" ? "tr_TR" : "en_US")),
      url: `/${locale}`,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);
  return (
    <Providers locale={locale as Locale} dictionary={dictionary}>
      {children}
    </Providers>
  );
}
