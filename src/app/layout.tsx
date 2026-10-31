import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { normalizeLocale, localeDir } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "4AB NET — إنترنت بضغطة زر",
    template: "%s | 4AB NET",
  },
  description:
    "4AB NET — باقات eSIM رقمية، تسليم آمن، ودعم بالعربية والإنجليزية والتركية. Digital eSIM packages with secure delivery.",
  applicationName: "4AB NET",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "4AB NET",
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "4AB NET",
    title: "4AB NET — إنترنت بضغطة زر",
    description:
      "باقات eSIM رقمية بتسليم آمن ودعم بالعربية والإنجليزية والتركية. Digital eSIM packages with secure delivery.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "4AB NET" }],
  },
  twitter: {
    card: "summary",
    title: "4AB NET — إنترنت بضغطة زر",
    description: "باقات eSIM رقمية بتسليم آمن ودعم بثلاث لغات.",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FA8F40",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const locale = normalizeLocale(h.get("x-locale"));
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
