import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { textContains } from "@/lib/db-search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; result?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t, date } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!hasPermission(ctx, "audit.view")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const result = query.result === "failure" ? "failure" : query.result === "success" ? "success" : "";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (q) {
    where.OR = [
      { action: textContains(q) },
      { entityType: textContains(q) },
      { entityId: textContains(q) },
      { admin: { is: { email: textContains(q) } } },
    ];
  }
  if (result === "success") where.success = true;
  if (result === "failure") where.success = false;

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (result) params.set("result", result);
    params.set("page", String(target));
    return `/${locale}/admin/audit?${params.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t("admin.audit.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("admin.audit.subtitle")}</p>
        </div>
        <p className="text-sm font-semibold text-muted">{t("product.resultsCount", { count: total })}</p>
      </div>

      <form method="get" className="card mt-5 flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="audit-q" className="label">{t("common.search")}</label>
          <input
            id="audit-q"
            name="q"
            defaultValue={q}
            placeholder={`${t("admin.audit.action")} / ${t("admin.audit.entity")}`}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="audit-result" className="label">{t("admin.audit.result")}</label>
          <select id="audit-result" name="result" defaultValue={result} className="input">
            <option value="">{t("common.all")}</option>
            <option value="success">{t("admin.audit.success")}</option>
            <option value="failure">{t("admin.audit.failure")}</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary btn-sm">{t("common.filter")}</button>
        <Link href={`/${locale}/admin/audit`} className="btn btn-ghost btn-sm">{t("common.reset")}</Link>
      </form>

      {entries.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-sm text-muted">{t("admin.audit.empty")}</p>
      ) : (
        <div className="table-wrap mt-5">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.audit.time")}</th>
                <th>{t("admin.audit.actor")}</th>
                <th>{t("admin.audit.action")}</th>
                <th>{t("admin.audit.entity")}</th>
                <th>{t("admin.audit.result")}</th>
                <th>{t("admin.audit.ip")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{date(entry.createdAt)}</td>
                  <td className="text-xs">
                    {entry.admin ? (
                      <>
                        <p className="font-semibold">{entry.admin.name}</p>
                        <p className="text-muted ltr-value" dir="ltr">{entry.admin.email}</p>
                      </>
                    ) : (
                      <span className="text-muted">
                        {entry.actorType === "TELEGRAM"
                          ? t("admin.audit.telegram")
                          : t("admin.audit.system")}
                      </span>
                    )}
                  </td>
                  <td>
                    <p className="text-xs font-bold ltr-value" dir="ltr">{entry.action}</p>
                    {entry.details && entry.details !== "{}" ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-muted">
                          {t("admin.audit.details")}
                        </summary>
                        <pre className="mt-1 max-w-[22rem] overflow-x-auto rounded bg-page p-2 text-[10px] ltr-value" dir="ltr">
                          {entry.details.slice(0, 800)}
                        </pre>
                      </details>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    <p>{entry.entityType}</p>
                    {entry.entityId ? (
                      <p className="max-w-[12rem] truncate text-muted ltr-value" dir="ltr">{entry.entityId}</p>
                    ) : null}
                  </td>
                  <td>
                    <span className={entry.success ? "badge badge-success" : "badge badge-danger"}>
                      {entry.success ? t("admin.audit.success") : t("admin.audit.failure")}
                    </span>
                  </td>
                  <td className="text-xs text-muted ltr-value" dir="ltr">{entry.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label={t("common.page")}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">{t("common.previous")}</Link>
          ) : null}
          <span className="text-sm text-muted">
            {t("common.page")} {page} {t("common.of")} {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">{t("common.next")}</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
