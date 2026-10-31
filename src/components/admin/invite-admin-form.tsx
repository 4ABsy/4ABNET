"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers";
import { PERMISSION_GROUPS } from "@/lib/constants";
import { inviteAdminAction, type ActionState } from "@/app/[locale]/admin/actions";
import { CopyButton } from "@/components/copy-button";

const ERROR_KEYS: Record<string, string> = {
  validation: "errors.validation",
  permissionRequired: "admin.admins.permissionRequired",
  emailTaken: "admin.admins.emailTaken",
  invitePending: "admin.invitePending",
  cannotGrant: "admin.admins.cannotGrant",
  forbidden: "errors.forbidden",
};

export function InviteAdminForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteAdminAction, {});
  const errorKey = state.error ? (ERROR_KEYS[state.error] ?? "errors.generic") : null;
  const invitePath = state.token ? `/${locale}/admin/invite/${state.token}` : null;

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">{t("admin.admins.add")}</h2>
      <p className="mt-1 text-xs leading-6 text-muted">{t("admin.admins.subtitle")}</p>

      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="invite-name" className="label">{t("admin.admins.name")}</label>
            <input id="invite-name" name="name" required minLength={2} maxLength={120} className="input" />
          </div>
          <div>
            <label htmlFor="invite-email" className="label">{t("admin.admins.email")}</label>
            <input id="invite-email" name="email" type="email" required dir="ltr" className="input ltr-value" />
          </div>
        </div>

        <fieldset>
          <legend className="label">{t("admin.admins.permissions")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
                      />
                      <span>{t(`admin.permissions.${permission}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {errorKey ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
            {t(errorKey)}
          </p>
        ) : null}

        {invitePath ? (
          <div className="rounded-xl border border-success/20 bg-success-soft p-3">
            <p className="text-xs font-semibold text-success">{t("admin.admins.invited")}</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              {t("admin.admins.inviteExpires", {
                date: state.expiresAt ? new Date(state.expiresAt).toLocaleString(locale) : "",
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-white px-2 py-1 text-[11px]" dir="ltr">
                {typeof window !== "undefined" ? `${window.location.origin}${invitePath}` : invitePath}
              </code>
              <CopyButton
                value={typeof window !== "undefined" ? `${window.location.origin}${invitePath}` : invitePath}
                label={t("admin.admins.copyInviteLink")}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">{t("admin.admins.inviteLinkOnce")}</p>
            <p className="text-[11px] text-muted">{t("admin.admins.inviteEmailUnavailable")}</p>
          </div>
        ) : null}

        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? t("common.sending") : t("admin.admins.invite")}
        </button>
      </form>
    </section>
  );
}
