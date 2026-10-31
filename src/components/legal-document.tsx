import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";

/**
 * Renders a policy page. Content can be overridden from store settings; when
 * empty, the translated defaults from the dictionary are used.
 */
export function LegalDocument({
  locale,
  title,
  override,
  fallback,
  extra,
}: {
  locale: Locale;
  title: string;
  override: string;
  fallback: readonly string[];
  extra?: { title: string; paragraphs: readonly string[] };
}) {
  const { t } = createI18n(locale);
  const overrideParagraphs = override
    .split(/\n{2,}|\r\n\r\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphs = overrideParagraphs.length ? overrideParagraphs : fallback;

  return (
    <div className="container-page mt-8 max-w-3xl">
      <h1 className="section-title">{title}</h1>
      {overrideParagraphs.length ? (
        <p className="mt-2 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
          {t("legal.overriddenNote")}
        </p>
      ) : null}

      <article className="card prose-policy mt-6 p-5 sm:p-8">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </article>

      {extra ? (
        <section className="card mt-5 p-5 sm:p-8">
          <h2 className="text-lg font-bold">{extra.title}</h2>
          <div className="prose-policy mt-3">
            {extra.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/${locale}/privacy`} className="btn btn-secondary btn-sm">
          {t("nav.privacy")}
        </Link>
        <Link href={`/${locale}/terms`} className="btn btn-secondary btn-sm">
          {t("nav.terms")}
        </Link>
        <Link href={`/${locale}/refund`} className="btn btn-secondary btn-sm">
          {t("nav.refund")}
        </Link>
        <Link href={`/${locale}/support`} className="btn btn-ghost btn-sm">
          {t("nav.support")}
        </Link>
      </div>
    </div>
  );
}
