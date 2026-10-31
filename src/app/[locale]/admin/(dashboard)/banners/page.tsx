import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/catalog";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { deleteBannerAction } from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "banners.manage")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const banners = await prisma.banner.findMany({
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.banners.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("product.resultsCount", { count: banners.length })}</p>
        </div>
        <Link href={`/${locale}/admin/banners/new`} className="btn btn-primary btn-sm">
          + {t("admin.banners.add")}
        </Link>
      </div>

      {banners.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.banners.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.banners.image")}</th>
                <th>{t("admin.banners.titleField")}</th>
                <th>{t("admin.banners.linkType")}</th>
                <th>{t("admin.banners.startsAt")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => {
                const translation = pickTranslation(banner.translations, locale);
                const missing = (["ar", "en", "tr"] as const).some(
                  (code) => !banner.translations.some((entry) => entry.locale === code),
                );
                return (
                  <tr key={banner.id}>
                    <td>
                      {banner.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={banner.imageUrl} alt="" className="h-12 w-24 rounded-lg object-cover" />
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <p className="font-semibold">{translation?.title ?? "—"}</p>
                      <p className="text-[11px] text-muted" dir="auto">{translation?.subtitle ?? ""}</p>
                      {missing ? (
                        <span className="badge badge-warning mt-1">{t("admin.banners.missingTranslations")}</span>
                      ) : null}
                    </td>
                    <td className="text-xs">
                      {banner.linkType}
                      {banner.linkValue ? (
                        <p className="max-w-[16rem] truncate text-muted ltr-value" dir="ltr">{banner.linkValue}</p>
                      ) : null}
                    </td>
                    <td className="text-xs text-muted">
                      {banner.startsAt ? date(banner.startsAt) : t("common.notProvided")}
                      <br />
                      {banner.endsAt ? date(banner.endsAt) : t("common.notProvided")}
                    </td>
                    <td>
                      <span className={banner.isVisible ? "badge badge-success" : "badge badge-neutral"}>
                        {banner.isVisible ? t("admin.banners.visible") : t("admin.categories.hidden")}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link href={`/${locale}/admin/banners/${banner.id}`} className="btn btn-secondary btn-sm">
                          {t("common.edit")}
                        </Link>
                        <ConfirmForm action={deleteBannerAction} message={t("admin.banners.deleteConfirm")}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={banner.id} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/banners`} />
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
