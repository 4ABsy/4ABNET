/**
 * Seed data for development and review.
 *
 * IMPORTANT: catalog names are presentation data, and every demo inventory
 * unit is explicitly marked DEMO-ONLY. No owner account, real bank account,
 * real activation code, or integration credential is created here.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/default-settings";

const prisma = new PrismaClient();

const DEMO_NOTICE = {
  ar: "بيانات تجريبية للعرض والتطوير — استبدلها ببيانات المنتج الفعلية قبل البيع.",
  en: "Demo data for review and development — replace it with the real product data before selling.",
  tr: "İnceleme ve geliştirme için demo veri — satıştan önce gerçek ürün verisiyle değiştirin.",
};

type Translation = { locale: "ar" | "en" | "tr"; name: string; shortDescription: string; description: string };

type SeedProduct = {
  slug: string;
  sku: string;
  categorySlug: string;
  imageUrl: string;
  priceMinor: number;
  originalPriceMinor?: number;
  dataAllowance: string;
  validityDays: number;
  network: string;
  countries: string[];
  isFeatured?: boolean;
  sortOrder: number;
  translations: Translation[];
};

const categories = [
  {
    slug: "europe",
    imageUrl: "/brand/product-europe.svg",
    sortOrder: 1,
    translations: [
      { locale: "ar", name: "أوروبا", description: "باقات إنترنت لرحلتك الأوروبية." },
      { locale: "en", name: "Europe", description: "Data packages for your European trip." },
      { locale: "tr", name: "Avrupa", description: "Avrupa seyahatiniz için internet paketleri." },
    ],
  },
  {
    slug: "turkiye",
    imageUrl: "/brand/product-turkiye.svg",
    sortOrder: 2,
    translations: [
      { locale: "ar", name: "تركيا", description: "باقات محلية للاستخدام داخل تركيا." },
      { locale: "en", name: "Türkiye", description: "Local packages for use inside Türkiye." },
      { locale: "tr", name: "Türkiye", description: "Türkiye içinde kullanım için yerel paketler." },
    ],
  },
  {
    slug: "usa",
    imageUrl: "/brand/product-usa.svg",
    sortOrder: 3,
    translations: [
      { locale: "ar", name: "الولايات المتحدة", description: "باقات للولايات المتحدة." },
      { locale: "en", name: "United States", description: "Packages for the United States." },
      { locale: "tr", name: "Amerika Birleşik Devletleri", description: "Amerika Birleşik Devletleri paketleri." },
    ],
  },
  {
    slug: "asia",
    imageUrl: "/brand/product-asia.svg",
    sortOrder: 4,
    translations: [
      { locale: "ar", name: "آسيا", description: "باقات لوجهات آسيوية مختارة." },
      { locale: "en", name: "Asia", description: "Packages for selected Asian destinations." },
      { locale: "tr", name: "Asya", description: "Seçili Asya destinasyonları için paketler." },
    ],
  },
  {
    slug: "middle-east",
    imageUrl: "/brand/product-middle-east.svg",
    sortOrder: 5,
    translations: [
      { locale: "ar", name: "الشرق الأوسط", description: "باقات لوجهات الشرق الأوسط." },
      { locale: "en", name: "Middle East", description: "Packages for Middle East destinations." },
      { locale: "tr", name: "Orta Doğu", description: "Orta Doğu destinasyonları için paketler." },
    ],
  },
  {
    slug: "global",
    imageUrl: "/brand/product-global.svg",
    sortOrder: 6,
    translations: [
      { locale: "ar", name: "عالمي", description: "باقات تغطي وجهات متعددة." },
      { locale: "en", name: "Global", description: "Packages covering multiple destinations." },
      { locale: "tr", name: "Global", description: "Birden fazla destinasyonu kapsayan paketler." },
    ],
  },
];

const products: SeedProduct[] = [
  {
    slug: "europe-10gb-30d",
    sku: "DEMO-EU-10GB-30D",
    categorySlug: "europe",
    imageUrl: "/brand/product-europe.svg",
    priceMinor: 74900,
    originalPriceMinor: 89900,
    dataAllowance: "10 GB",
    validityDays: 30,
    network: "Demo LTE/5G",
    countries: ["France", "Germany", "Spain", "Italy"],
    isFeatured: true,
    sortOrder: 1,
    translations: [
      {
        locale: "ar",
        name: "أوروبا 10 GB — 30 يوماً",
        shortDescription: "باقة بيانات لرحلتك الأوروبية.",
        description: `باقة بيانات لعدة دول أوروبية. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Europe 10 GB — 30 days",
        shortDescription: "Data package for your European trip.",
        description: `Data package for several European countries. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Avrupa 10 GB — 30 gün",
        shortDescription: "Avrupa seyahatiniz için veri paketi.",
        description: `Birden fazla Avrupa ülkesi için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "europe-5gb-15d",
    sku: "DEMO-EU-5GB-15D",
    categorySlug: "europe",
    imageUrl: "/brand/product-europe.svg",
    priceMinor: 39900,
    dataAllowance: "5 GB",
    validityDays: 15,
    network: "Demo LTE/5G",
    countries: ["France", "Germany", "Spain"],
    sortOrder: 2,
    translations: [
      {
        locale: "ar",
        name: "أوروبا 5 GB — 15 يوماً",
        shortDescription: "باقة قصيرة لرحلة أوروبية.",
        description: `باقة بيانات لعدة دول أوروبية. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Europe 5 GB — 15 days",
        shortDescription: "A short package for a European trip.",
        description: `Data package for several European countries. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Avrupa 5 GB — 15 gün",
        shortDescription: "Avrupa seyahati için kısa paket.",
        description: `Birden fazla Avrupa ülkesi için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "turkiye-20gb-30d",
    sku: "DEMO-TR-20GB-30D",
    categorySlug: "turkiye",
    imageUrl: "/brand/product-turkiye.svg",
    priceMinor: 49900,
    originalPriceMinor: 59900,
    dataAllowance: "20 GB",
    validityDays: 30,
    network: "Demo LTE/5G",
    countries: ["Türkiye"],
    isFeatured: true,
    sortOrder: 3,
    translations: [
      {
        locale: "ar",
        name: "تركيا 20 GB — 30 يوماً",
        shortDescription: "باقة بيانات محلية داخل تركيا.",
        description: `باقة بيانات للاستخدام داخل تركيا. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Türkiye 20 GB — 30 days",
        shortDescription: "Local data package inside Türkiye.",
        description: `Data package for use inside Türkiye. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Türkiye 20 GB — 30 gün",
        shortDescription: "Türkiye içinde yerel veri paketi.",
        description: `Türkiye içinde kullanım için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "turkiye-5gb-7d",
    sku: "DEMO-TR-5GB-7D",
    categorySlug: "turkiye",
    imageUrl: "/brand/product-turkiye.svg",
    priceMinor: 19900,
    dataAllowance: "5 GB",
    validityDays: 7,
    network: "Demo LTE/5G",
    countries: ["Türkiye"],
    sortOrder: 4,
    translations: [
      {
        locale: "ar",
        name: "تركيا 5 GB — 7 أيام",
        shortDescription: "باقة أسبوعية قصيرة.",
        description: `باقة بيانات للاستخدام داخل تركيا. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Türkiye 5 GB — 7 days",
        shortDescription: "A short weekly package.",
        description: `Data package for use inside Türkiye. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Türkiye 5 GB — 7 gün",
        shortDescription: "Kısa haftalık paket.",
        description: `Türkiye içinde kullanım için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "usa-15gb-30d",
    sku: "DEMO-US-15GB-30D",
    categorySlug: "usa",
    imageUrl: "/brand/product-usa.svg",
    priceMinor: 129900,
    dataAllowance: "15 GB",
    validityDays: 30,
    network: "Demo LTE/5G",
    countries: ["United States"],
    isFeatured: true,
    sortOrder: 5,
    translations: [
      {
        locale: "ar",
        name: "الولايات المتحدة 15 GB — 30 يوماً",
        shortDescription: "باقة بيانات لرحلتك إلى الولايات المتحدة.",
        description: `باقة بيانات للولايات المتحدة. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "United States 15 GB — 30 days",
        shortDescription: "Data package for your trip to the United States.",
        description: `Data package for the United States. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "ABD 15 GB — 30 gün",
        shortDescription: "ABD seyahatiniz için veri paketi.",
        description: `Amerika Birleşik Devletleri için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "asia-8gb-15d",
    sku: "DEMO-AS-8GB-15D",
    categorySlug: "asia",
    imageUrl: "/brand/product-asia.svg",
    priceMinor: 69900,
    dataAllowance: "8 GB",
    validityDays: 15,
    network: "Demo LTE/5G",
    countries: ["Japan", "South Korea", "Thailand"],
    sortOrder: 6,
    translations: [
      {
        locale: "ar",
        name: "آسيا 8 GB — 15 يوماً",
        shortDescription: "باقة لعدة وجهات آسيوية.",
        description: `باقة بيانات لوجهات آسيوية مختارة. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Asia 8 GB — 15 days",
        shortDescription: "A package for several Asian destinations.",
        description: `Data package for selected Asian destinations. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Asya 8 GB — 15 gün",
        shortDescription: "Birden fazla Asya destinasyonu için paket.",
        description: `Seçili Asya destinasyonları için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "middle-east-5gb-15d",
    sku: "DEMO-ME-5GB-15D",
    categorySlug: "middle-east",
    imageUrl: "/brand/product-middle-east.svg",
    priceMinor: 44900,
    dataAllowance: "5 GB",
    validityDays: 15,
    network: "Demo LTE/5G",
    countries: ["United Arab Emirates", "Qatar", "Saudi Arabia"],
    sortOrder: 7,
    translations: [
      {
        locale: "ar",
        name: "الشرق الأوسط 5 GB — 15 يوماً",
        shortDescription: "باقة لوجهات الشرق الأوسط.",
        description: `باقة بيانات لوجهات الشرق الأوسط. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Middle East 5 GB — 15 days",
        shortDescription: "A package for Middle East destinations.",
        description: `Data package for Middle East destinations. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Orta Doğu 5 GB — 15 gün",
        shortDescription: "Orta Doğu destinasyonları için paket.",
        description: `Orta Doğu destinasyonları için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
  {
    slug: "global-20gb-365d",
    sku: "DEMO-GL-20GB-365D",
    categorySlug: "global",
    imageUrl: "/brand/product-global.svg",
    priceMinor: 249900,
    dataAllowance: "20 GB",
    validityDays: 365,
    network: "Demo LTE/5G",
    countries: ["Multiple destinations"],
    isFeatured: true,
    sortOrder: 8,
    translations: [
      {
        locale: "ar",
        name: "عالمي 20 GB — 365 يوماً",
        shortDescription: "باقة طويلة لوجهات متعددة.",
        description: `باقة بيانات لوجهات متعددة. ${DEMO_NOTICE.ar}`,
      },
      {
        locale: "en",
        name: "Global 20 GB — 365 days",
        shortDescription: "A long-validity package for multiple destinations.",
        description: `Data package for multiple destinations. ${DEMO_NOTICE.en}`,
      },
      {
        locale: "tr",
        name: "Global 20 GB — 365 gün",
        shortDescription: "Birden fazla destinasyon için uzun süreli paket.",
        description: `Birden fazla destinasyon için veri paketi. ${DEMO_NOTICE.tr}`,
      },
    ],
  },
];

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.storeSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: {},
    });
  }
}

async function seedCategories() {
  const map = new Map<string, string>();
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        isVisible: true,
      },
      update: {
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
      },
    });
    map.set(category.slug, row.id);
    for (const translation of category.translations) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: row.id, locale: translation.locale } },
        create: { categoryId: row.id, ...translation },
        update: { name: translation.name, description: translation.description },
      });
    }
  }
  return map;
}

async function seedProducts(categoryIds: Map<string, string>) {
  for (const product of products) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) throw new Error(`Missing category ${product.categorySlug}`);

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        sku: product.sku,
        categoryId,
        imageUrl: product.imageUrl,
        galleryJson: JSON.stringify([product.imageUrl]),
        priceMinor: product.priceMinor,
        originalPriceMinor: product.originalPriceMinor ?? null,
        currency: "TRY",
        dataAllowance: product.dataAllowance,
        validityDays: product.validityDays,
        network: product.network,
        countriesJson: JSON.stringify(product.countries),
        activationNotes: null,
        isActive: true,
        isFeatured: Boolean(product.isFeatured),
        sortOrder: product.sortOrder,
      },
      update: {
        categoryId,
        imageUrl: product.imageUrl,
        galleryJson: JSON.stringify([product.imageUrl]),
        priceMinor: product.priceMinor,
        originalPriceMinor: product.originalPriceMinor ?? null,
        dataAllowance: product.dataAllowance,
        validityDays: product.validityDays,
        network: product.network,
        countriesJson: JSON.stringify(product.countries),
        isFeatured: Boolean(product.isFeatured),
        sortOrder: product.sortOrder,
      },
    });

    for (const translation of product.translations) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: row.id, locale: translation.locale } },
        create: { productId: row.id, ...translation },
        update: {
          name: translation.name,
          shortDescription: translation.shortDescription,
          description: translation.description,
        },
      });
    }

    const existingUnits = await prisma.inventoryUnit.count({ where: { productId: row.id } });
    if (existingUnits === 0) {
      await prisma.inventoryUnit.createMany({
        data: Array.from({ length: 6 }, (_, index) => ({
          productId: row.id,
          status: "AVAILABLE",
          activationCode: `DEMO-ONLY-${product.sku}-${String(index + 1).padStart(2, "0")}`,
          instructions:
            "DEMO ONLY — this activation code is not valid. Replace demo inventory before accepting real orders.",
          notes: "DEMO-ONLY inventory unit created by prisma/seed.ts",
        })),
      });
    }
  }
}

async function seedBanners() {
  const existing = await prisma.banner.count();
  if (existing > 0) return;

  const banners = [
    {
      imageUrl: "/brand/banner-esim.svg",
      linkType: "CATEGORY",
      linkValue: "europe",
      sortOrder: 1,
      translations: [
        {
          locale: "ar",
          title: "eSIM جاهزة لرحلتك",
          subtitle: "اختر وجهتك وأضف الباقة إلى السلة.",
          ctaLabel: "تصفح أوروبا",
        },
        {
          locale: "en",
          title: "An eSIM ready for your trip",
          subtitle: "Choose your destination and add a package to the cart.",
          ctaLabel: "Browse Europe",
        },
        {
          locale: "tr",
          title: "Seyahatinize hazır eSIM",
          subtitle: "Destinasyonunuzu seçin ve paketi sepete ekleyin.",
          ctaLabel: "Avrupa'yı keşfet",
        },
      ],
    },
    {
      imageUrl: "/brand/banner-offer.svg",
      linkType: "PRODUCT",
      linkValue: "europe-10gb-30d",
      sortOrder: 2,
      translations: [
        {
          locale: "ar",
          title: "عرض على باقة مختارة",
          subtitle: "سعر مخفض لفترة محدودة على باقة أوروبا 10 GB.",
          ctaLabel: "عرض الباقة",
        },
        {
          locale: "en",
          title: "An offer on a selected package",
          subtitle: "A limited-time reduced price on the Europe 10 GB package.",
          ctaLabel: "View package",
        },
        {
          locale: "tr",
          title: "Seçili pakette fırsat",
          subtitle: "Avrupa 10 GB paketinde sınırlı süreli indirimli fiyat.",
          ctaLabel: "Paketi gör",
        },
      ],
    },
  ];

  for (const banner of banners) {
    const row = await prisma.banner.create({
      data: {
        imageUrl: banner.imageUrl,
        linkType: banner.linkType,
        linkValue: banner.linkValue,
        sortOrder: banner.sortOrder,
        isVisible: true,
      },
    });
    for (const translation of banner.translations) {
      await prisma.bannerTranslation.create({
        data: { bannerId: row.id, ...translation },
      });
    }
  }
}

async function main() {
  await seedSettings();
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedBanners();
  console.log("Seed complete (demo catalog + inventory). No owner account was created.");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
