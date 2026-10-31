import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/catalog";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { deleteCategoryAction } from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "categories.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const categories = await prisma.category.findMany({
    include: {
      translations: true,
      _count: { select: { products: true } },
    },
    orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.categories.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("product.resultsCount", { count: categories.length })}</p>
        </div>
        <Link href={`/${locale}/admin/categories/new`} className="btn btn-primary btn-sm">
          + {t("admin.categories.add")}
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.categories.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.categories.name")}</th>
                <th>{t("admin.categories.slug")}</th>
                <th>{t("admin.sections.products")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const translation = pickTranslation(category.translations, locale);
                const missing = (["ar", "en", "tr"] as const).some(
                  (code) => !category.translations.some((entry) => entry.locale === code),
                );
                return (
                  <tr key={category.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {category.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={category.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : null}
                        <div>
                          <p className="font-semibold">{translation?.name ?? category.slug}</p>
                          {missing ? (
                            <span className="badge badge-warning mt-1">{t("admin.categories.missingTranslations")}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-xs ltr-value" dir="ltr">{category.slug}</td>
                    <td>{category._count.products}</td>
                    <td>
                      <span className={category.isVisible ? "badge badge-success" : "badge badge-neutral"}>
                        {category.isVisible ? t("admin.categories.visible") : t("admin.categories.hidden")}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/${locale}/admin/categories/${category.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          {t("common.edit")}
                        </Link>
                        <ConfirmForm
                          action={deleteCategoryAction}
                          message={t("admin.categories.deleteConfirm")}
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={category.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/categories`} />
                          <button type="submit" className="btn btn-danger btn-sm">
                            {t("common.delete")}
                          </button>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
