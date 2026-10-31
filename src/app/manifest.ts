import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "4AB NET — إنترنت بضغطة زر",
    short_name: "4AB NET",
    description:
      "4AB NET — باقات eSIM رقمية، تسليم آمن، ودعم بالعربية والإنجليزية والتركية. Digital eSIM packages with secure delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF8F4",
    theme_color: "#FA8F40",
    lang: "ar",
    dir: "rtl",
    categories: ["shopping", "travel", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "الباقات",
        short_name: "الباقات",
        url: "/ar/products",
      },
      {
        name: "تتبع الطلب",
        short_name: "تتبع",
        url: "/ar/track",
      },
    ],
  };
}
