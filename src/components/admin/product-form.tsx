import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { LOCALE_NAMES, type Locale } from "@/lib/constants";
import { pickTranslation } from "@/lib/catalog";
import { createI18n } from "@/lib/i18n";
import { saveProductAction } from "@/app/[locale]/admin/actions";

type AdminProduct = Prisma.ProductGetPayload<{
  include: { translations: true; relatedFrom: true };
}>;

type CategoryRow = Prisma.CategoryGetPayload<{ include: { translations: true } }>;

type RelatedOption = Pick<
  Prisma.ProductGetPayload<{ include: { translations: true } }>,
  "id" | "slug" | "imageUrl" | "isArchived"
> & { translations: { locale: string; name: string }[] };

export function ProductForm({
  locale,
  product,
  categories,
  relatedOptions,
}: {
  locale: Locale;
  product: AdminProduct | null;
  categories: CategoryRow[];
  relatedOptions: RelatedOption[];
}) {
  const { t } = createI18n(locale);
  const translation = (code: Locale) => product?.translations.find((entry) => entry.locale === code);
  const selectedRelated = new Set(product?.relatedFrom.map((entry) => entry.relatedId) ?? []);
  const price = product ? (product.priceMinor / 100).toFixed(2) : "";
  const originalPrice =
    product?.originalPriceMinor !== null && product?.originalPriceMinor !== undefined
      ? (product.originalPriceMinor / 100).toFixed(2)
      : "";

  return (
    <form action={saveProductAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="returnTo" value={`/${locale}/admin/products`} />
      <input type="hidden" name="existingImage" value={product?.imageUrl ?? ""} />

      <section className="card p-5">
        <h2 className="text-lg font-bold">{t("admin.products.title")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="product-slug" className="label">{t("admin.products.slug")}</label>
            <input
              id="product-slug"
              name="slug"
              defaultValue={product?.slug ?? ""}
              required
              dir="ltr"
              maxLength={80}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="input ltr-value"
            />
          </div>
          <div>
            <label htmlFor="product-sku" className="label">{t("admin.products.sku")}</label>
            <input
              id="product-sku"
              name="sku"
              defaultValue={product?.sku ?? ""}
              dir="ltr"
              maxLength={80}
              className="input ltr-value"
            />
          </div>
          <div>
            <label htmlFor="product-category" className="label">{t("admin.products.category")}</label>
            <select
              id="product-category"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              required
              className="input"
            >
              <option value="">{t("admin.products.noCategory")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {pickTranslation(category.translations, locale)?.name ?? category.slug}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product-sort" className="label">{t("admin.products.sortOrder")}</label>
            <input
              id="product-sort"
              name="sortOrder"
              type="number"
              defaultValue={product?.sortOrder ?? 0}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="product-price" className="label">{t("admin.products.price")}</label>
            <input
              id="product-price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={price}
              placeholder="199.00"
              required
              dir="ltr"
              className="input ltr-value"
            />
          </div>
          <div>
            <label htmlFor="product-original-price" className="label">{t("admin.products.originalPrice")}</label>
            <input
              id="product-original-price"
              name="originalPrice"
              type="text"
              inputMode="decimal"
              defaultValue={originalPrice}
              placeholder="249.00"
              dir="ltr"
              className="input ltr-value"
            />
          </div>
          <div>
            <label htmlFor="product-data" className="label">{t("admin.products.dataAllowance")}</label>
            <input
              id="product-data"
              name="dataAllowance"
              defaultValue={product?.dataAllowance ?? ""}
              placeholder="10 GB"
              dir="ltr"
              maxLength={40}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="product-validity" className="label">{t("admin.products.validityDays")}</label>
            <input
              id="product-validity"
              name="validityDays"
              type="number"
              min={1}
              max={3650}
              defaultValue={product?.validityDays ?? ""}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="product-network" className="label">{t("admin.products.network")}</label>
            <input
              id="product-network"
              name="network"
              defaultValue={product?.network ?? ""}
              dir="ltr"
              maxLength={80}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="product-image" className="label">{t("admin.products.image")}</label>
            <input
              id="product-image"
              name="imageFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="input"
            />
            <p className="hint">{t("admin.products.imageTypeHint")}</p>
          </div>
        </div>

        {product?.imageUrl ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <span className="text-xs text-muted">{t("admin.products.changeImage")}</span>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="product-countries" className="label">{t("admin.products.countries")}</label>
            <textarea
              id="product-countries"
              name="countries"
              defaultValue={product ? (JSON.parse(product.countriesJson) as string[]).join("\n") : ""}
              rows={4}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="product-gallery" className="label">{t("admin.products.gallery")}</label>
            <textarea
              id="product-gallery"
              name="gallery"
              defaultValue={product ? (JSON.parse(product.galleryJson) as string[]).join("\n") : ""}
              rows={4}
              dir="ltr"
              className="input ltr-value"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="product-activation" className="label">{t("admin.products.activationNotes")}</label>
          <textarea
            id="product-activation"
            name="activationNotes"
            defaultValue={product?.activationNotes ?? ""}
            rows={3}
            maxLength={2000}
            className="input"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product ? product.isActive : true}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            {t("admin.products.active")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.isFeatured ?? false}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            {t("admin.products.featured")}
          </label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">{t("admin.products.translations")}</h2>
        <p className="mt-1 text-xs leading-6 text-muted">{t("admin.products.translationHelp")}</p>

        <div className="mt-4 space-y-5">
          {(["ar", "en", "tr"] as const).map((code) => {
            const row = translation(code);
            return (
              <div key={code} className="rounded-xl border border-line p-4">
                <h3 className="text-sm font-bold">{LOCALE_NAMES[code]}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`name-${code}`} className="label">
                      {t("admin.products.name")} ({LOCALE_NAMES[code]})
                    </label>
                    <input
                      id={`name-${code}`}
                      name={`name_${code}`}
                      defaultValue={row?.name ?? ""}
                      required={code === "ar"}
                      maxLength={160}
                      dir={code === "ar" ? "rtl" : "ltr"}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor={`short-${code}`} className="label">
                      {t("admin.products.shortDescription")} ({LOCALE_NAMES[code]})
                    </label>
                    <input
                      id={`short-${code}`}
                      name={`short_${code}`}
                      defaultValue={row?.shortDescription ?? ""}
                      maxLength={300}
                      dir={code === "ar" ? "rtl" : "ltr"}
                      className="input"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label htmlFor={`desc-${code}`} className="label">
                    {t("admin.products.description")} ({LOCALE_NAMES[code]})
                  </label>
                  <textarea
                    id={`desc-${code}`}
                    name={`desc_${code}`}
                    defaultValue={row?.description ?? ""}
                    rows={3}
                    maxLength={5000}
                    dir={code === "ar" ? "rtl" : "ltr"}
                    className="input"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {relatedOptions.length ? (
        <section className="card p-5">
          <h2 className="text-lg font-bold">{t("admin.products.related")}</h2>
          <p className="mt-1 text-xs leading-6 text-muted">{t("admin.products.relatedHint")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {relatedOptions
              .filter((option) => option.id !== product?.id)
              .map((option) => (
                <label key={option.id} className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
                  <input
                    type="checkbox"
                    name="relatedIds"
                    value={option.id}
                    defaultChecked={selectedRelated.has(option.id)}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span className="min-w-0 truncate">
                    {pickTranslation(option.translations, locale)?.name ?? option.slug}
                  </span>
                </label>
              ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          {product ? t("admin.products.save") : t("admin.products.create")}
        </button>
        <Link href={`/${locale}/admin/products`} className="btn btn-secondary">
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
