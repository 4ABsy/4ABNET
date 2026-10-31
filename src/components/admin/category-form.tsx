import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { LOCALE_NAMES, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { saveCategoryAction } from "@/app/[locale]/admin/actions";

type AdminCategory = Prisma.CategoryGetPayload<{ include: { translations: true } }>;

export function CategoryForm({
  locale,
  category,
}: {
  locale: Locale;
  category: AdminCategory | null;
}) {
  const { t } = createI18n(locale);
  const row = (code: Locale) => category?.translations.find((entry) => entry.locale === code);

  return (
    <form action={saveCategoryAction} className="card space-y-4 p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <input type="hidden" name="returnTo" value={`/${locale}/admin/categories`} />
      <input type="hidden" name="existingImage" value={category?.imageUrl ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category-slug" className="label">{t("admin.categories.slug")}</label>
          <input
            id="category-slug"
            name="slug"
            defaultValue={category?.slug ?? ""}
            required
            dir="ltr"
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="input ltr-value"
          />
        </div>
        <div>
          <label htmlFor="category-sort" className="label">{t("admin.categories.sortOrder")}</label>
          <input
            id="category-sort"
            name="sortOrder"
            type="number"
            defaultValue={category?.sortOrder ?? 0}
            className="input"
          />
        </div>
      </div>

      <div className="space-y-4">
        {(["ar", "en", "tr"] as const).map((code) => (
          <fieldset key={code} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-bold">{LOCALE_NAMES[code]}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`category-name-${code}`} className="label">
                  {t("admin.categories.name")} ({LOCALE_NAMES[code]})
                </label>
                <input
                  id={`category-name-${code}`}
                  name={`name_${code}`}
                  defaultValue={row(code)?.name ?? ""}
                  required={code === "ar"}
                  maxLength={120}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`category-desc-${code}`} className="label">
                  {t("admin.categories.description")} ({LOCALE_NAMES[code]})
                </label>
                <input
                  id={`category-desc-${code}`}
                  name={`description_${code}`}
                  defaultValue={row(code)?.description ?? ""}
                  maxLength={500}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className="input"
                />
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category-image" className="label">{t("admin.categories.image")}</label>
          <input
            id="category-image"
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="isVisible"
            defaultChecked={category ? category.isVisible : true}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          {t("admin.categories.visible")}
        </label>
      </div>

      {category?.imageUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={category.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          <span className="text-xs text-muted">{t("admin.categories.image")}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          {category ? t("admin.categories.save") : t("admin.categories.create")}
        </button>
        <Link href={`/${locale}/admin/categories`} className="btn btn-secondary">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
