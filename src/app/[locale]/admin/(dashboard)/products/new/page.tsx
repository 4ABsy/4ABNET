import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "products.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const [categories, relatedOptions] = await Promise.all([
    prisma.category.findMany({
      where: { isArchived: false },
      include: { translations: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.product.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        slug: true,
        imageUrl: true,
        isArchived: true,
        translations: { select: { locale: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 60,
    }),
  ]);

  return (
    <div>
      <Link href={`/${locale}/admin/products`} className="link text-xs font-semibold">
        ← {t("admin.products.title")}
      </Link>
      <h1 className="mt-1 mb-5 text-2xl font-extrabold text-ink">{t("admin.products.add")}</h1>
      <ProductForm locale={locale} product={null} categories={categories} relatedOptions={relatedOptions} />
    </div>
  );
}
