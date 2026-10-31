import { notFound } from "next/navigation";
import {
  PERMISSION_GROUPS,
  isLocale,
  isPermission,
  type Locale,
} from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/json";
import { AdminFlash } from "@/components/admin/flash";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { InviteAdminForm } from "@/components/admin/invite-admin-form";
import {
  revokeInvitationAction,
  setAdminStatusAction,
  updateOwnTelegramIdAction,
  updatePermissionsAction,
} from "@/app/[locale]/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminAdministratorsPage({
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
  if (!ctx || !isOwner(ctx)) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const [admins, invitations] = await Promise.all([
    prisma.adminUser.findMany({
      include: { permissions: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.adminInvitation.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <AdminFlash locale={locale} ok={query.ok} error={query.error} />

      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.admins.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.admins.subtitle")}</p>
      </div>

      <div className="mt-5">
        <InviteAdminForm locale={locale} />
      </div>

      <section className="mt-5">
        <h2 className="text-lg font-bold">{t("admin.admins.title")}</h2>
        {admins.length === 0 ? (
          <p className="card mt-3 p-6 text-center text-sm text-muted">{t("admin.admins.noAdmins")}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {admins.map((admin) => {
              const permissions = admin.permissions
                .map((entry) => entry.permission)
                .filter(isPermission);
              const owner = admin.role === "OWNER";
              return (
                <article key={admin.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">
                        {admin.name}
                        {admin.id === ctx.id ? (
                          <span className="badge badge-brand ms-2">{t("admin.admins.you")}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted ltr-value" dir="ltr">{admin.email}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {t("admin.admins.role")}:{" "}
                        {owner ? t("admin.roleOwner") : t("admin.roleAdmin")} ·{" "}
                        {t("admin.admins.status")}:{" "}
                        {admin.status === "ACTIVE"
                          ? t("admin.admins.active")
                          : admin.status === "SUSPENDED"
                            ? t("admin.admins.suspended")
                            : t("admin.admins.removed")}
                      </p>
                    </div>
                    {!owner ? (
                      <div className="flex flex-wrap gap-1.5">
                        {admin.status === "ACTIVE" ? (
                          <ConfirmForm
                            action={setAdminStatusAction}
                            message={t("admin.admins.suspendConfirm")}
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={admin.id} />
                            <input type="hidden" name="status" value="SUSPENDED" />
                            <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                              {t("admin.admins.suspend")}
                            </button>
                          </ConfirmForm>
                        ) : (
                          <form action={setAdminStatusAction}>
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={admin.id} />
                            <input type="hidden" name="status" value="ACTIVE" />
                            <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                              {t("admin.admins.reactivate")}
                            </button>
                          </form>
                        )}
                        <ConfirmForm
                          action={setAdminStatusAction}
                          message={t("admin.admins.removeConfirm")}
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={admin.id} />
                          <input type="hidden" name="status" value="REMOVED" />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                          <button type="submit" className="btn btn-danger btn-sm">
                            {t("admin.admins.remove")}
                          </button>
                        </ConfirmForm>
                      </div>
                    ) : null}
                  </div>

                  {owner ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs leading-6 text-muted">{t("admin.admins.ownerProtected")}</p>
                      {admin.id === ctx.id ? (
                        <form action={updateOwnTelegramIdAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                          <div className="min-w-52 flex-1">
                            <label htmlFor={`owner-telegram-${admin.id}`} className="label">
                              {t("admin.admins.telegramId")}
                            </label>
                            <input
                              id={`owner-telegram-${admin.id}`}
                              name="telegramId"
                              defaultValue={admin.telegramId ?? ""}
                              inputMode="numeric"
                              pattern="\d{5,20}"
                              maxLength={20}
                              dir="ltr"
                              className="input ltr-value"
                              placeholder="123456789"
                            />
                          </div>
                          <button type="submit" className="btn btn-secondary btn-sm">
                            {t("common.save")}
                          </button>
                          <p className="hint w-full">{t("admin.admins.telegramHint")}</p>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-ink">
                        {t("admin.admins.editPermissions")}
                      </summary>
                      <form action={updatePermissionsAction} className="mt-3 space-y-3">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={admin.id} />
                        <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {PERMISSION_GROUPS.map((group) => (
                            <div key={group.key} className="rounded-xl border border-line p-3">
                              <p className="text-xs font-bold">{t(`admin.permissionGroups.${group.key}`)}</p>
                              <div className="mt-2 space-y-1.5">
                                {group.permissions.map((permission) => (
                                  <label key={permission} className="flex items-start gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      name="permissions"
                                      value={permission}
                                      defaultChecked={permissions.includes(permission)}
                                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
                                    />
                                    <span>{t(`admin.permissions.${permission}`)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="sm:max-w-xs">
                          <label htmlFor={`telegram-${admin.id}`} className="label">
                            {t("admin.admins.telegramId")}
                          </label>
                          <input
                            id={`telegram-${admin.id}`}
                            name="telegramId"
                            defaultValue={admin.telegramId ?? ""}
                            dir="ltr"
                            inputMode="numeric"
                            maxLength={32}
                            className="input ltr-value"
                          />
                          <p className="hint">{t("admin.admins.telegramHint")}</p>
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm">
                          {t("admin.admins.savePermissions")}
                        </button>
                      </form>
                    </details>
                  )}

                  <p className="mt-3 text-[11px] text-muted">
                    {t("admin.admins.permissions")}:{" "}
                    {owner
                      ? t("admin.admins.owner")
                      : permissions.map((permission) => t(`admin.permissions.${permission}`)).join(" · ") ||
                        t("common.none")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">{t("admin.admins.pendingInvitations")}</h2>
        {invitations.length === 0 ? (
          <p className="card mt-3 p-6 text-center text-sm text-muted">{t("admin.admins.noInvitations")}</p>
        ) : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.admins.name")}</th>
                  <th>{t("admin.admins.email")}</th>
                  <th>{t("admin.admins.permissions")}</th>
                  <th>{t("admin.admins.pending")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>
                      <p className="font-semibold">{invitation.name}</p>
                      <p className="text-[11px] text-muted">{invitation.invitedBy.name}</p>
                    </td>
                    <td className="text-xs ltr-value" dir="ltr">{invitation.email}</td>
                    <td className="text-xs">
                      {parseJsonArray(invitation.permissions)
                        .filter(isPermission)
                        .map((permission) => t(`admin.permissions.${permission}`))
                        .join(" · ") || t("common.none")}
                    </td>
                    <td className="text-xs text-muted">
                      {t("admin.admins.inviteExpires", { date: date(invitation.expiresAt) })}
                    </td>
                    <td>
                      <ConfirmForm action={revokeInvitationAction} message={t("admin.admins.revokeInvite")}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={invitation.id} />
                        <input type="hidden" name="returnTo" value={`/${locale}/admin/administrators`} />
                        <button type="submit" className="btn btn-danger btn-sm">
                          {t("admin.admins.revokeInvite")}
                        </button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-5 rounded-xl bg-page p-3 text-xs leading-6 text-muted">
        {t("admin.admins.ownerProtected")} {t("admin.admins.inviteLinkNote")}
      </p>
    </div>
  );
}
