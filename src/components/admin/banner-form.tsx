import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { LOCALE_NAMES, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { saveBannerAction } from "@/app/[locale]/admin/actions";

type AdminBanner = Prisma.BannerGetPayload<{ include: { translations: true } }>;

function localInput(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 16);
}

export function BannerForm({
  locale,
  banner,
}: {
  locale: Locale;
  banner: AdminBanner | null;
}) {
  const { t } = createI18n(locale);
  const row = (code: Locale) => banner?.translations.find((entry) => entry.locale === code);

  return (
    <form action={saveBannerAction} className="card space-y-4 p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={banner?.id ?? ""} />
      <input type="hidden" name="returnTo" value={`/${locale}/admin/banners`} />
      <input type="hidden" name="existingImage" value={banner?.imageUrl ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="banner-link-type" className="label">{t("admin.banners.linkType")}</label>
          <select
            id="banner-link-type"
            name="linkType"
            defaultValue={banner?.linkType ?? "NONE"}
            className="input"
          >
            <option value="NONE">{t("admin.banners.linkNone")}</option>
            <option value="PRODUCT">{t("admin.banners.linkProduct")}</option>
            <option value="CATEGORY">{t("admin.banners.linkCategory")}</option>
            <option value="URL">{t("admin.banners.linkUrl")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="banner-link-value" className="label">{t("admin.banners.linkValue")}</label>
          <input
            id="banner-link-value"
            name="linkValue"
            defaultValue={banner?.linkValue ?? ""}
            maxLength={500}
            dir="ltr"
            className="input ltr-value"
          />
        </div>
        <div>
          <label htmlFor="banner-sort" className="label">{t("admin.banners.sortOrder")}</label>
          <input
            id="banner-sort"
            name="sortOrder"
            type="number"
            defaultValue={banner?.sortOrder ?? 0}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="banner-image" className="label">{t("admin.banners.image")}</label>
          <input
            id="banner-image"
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="banner-starts" className="label">{t("admin.banners.startsAt")}</label>
          <input
            id="banner-starts"
            name="startsAt"
            type="datetime-local"
            defaultValue={localInput(banner?.startsAt ?? null)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="banner-ends" className="label">{t("admin.banners.endsAt")}</label>
          <input
            id="banner-ends"
            name="endsAt"
            type="datetime-local"
            defaultValue={localInput(banner?.endsAt ?? null)}
            className="input"
          />
        </div>
      </div>

      <p className="hint">{t("admin.banners.scheduleHint")}</p>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="isVisible"
          defaultChecked={banner ? banner.isVisible : true}
          className="h-4 w-4 accent-[var(--color-brand)]"
        />
        {t("admin.banners.visible")}
      </label>

      {banner?.imageUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.imageUrl} alt="" className="h-16 w-28 rounded-lg object-cover" />
          <span className="text-xs text-muted">{t("admin.banners.image")}</span>
        </div>
      ) : null}

      <div className="space-y-4">
        {(["ar", "en", "tr"] as const).map((code) => (
          <fieldset key={code} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-bold">{LOCALE_NAMES[code]}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`banner-title-${code}`} className="label">
                  {t("admin.banners.titleField")} ({LOCALE_NAMES[code]})
                </label>
                <input
                  id={`banner-title-${code}`}
                  name={`title_${code}`}
                  defaultValue={row(code)?.title ?? ""}
                  required={code === "ar"}
                  maxLength={160}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`banner-subtitle-${code}`} className="label">
                  {t("admin.banners.subtitle")} ({LOCALE_NAMES[code]})
                </label>
                <input
                  id={`banner-subtitle-${code}`}
                  name={`subtitle_${code}`}
                  defaultValue={row(code)?.subtitle ?? ""}
                  maxLength={300}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`banner-cta-${code}`} className="label">
                  {t("admin.banners.cta")} ({LOCALE_NAMES[code]})
                </label>
                <input
                  id={`banner-cta-${code}`}
                  name={`cta_${code}`}
                  defaultValue={row(code)?.ctaLabel ?? ""}
                  maxLength={80}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className="input"
                />
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          {banner ? t("admin.banners.save") : t("admin.banners.create")}
        </button>
        <Link href={`/${locale}/admin/banners`} className="btn btn-secondary">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
