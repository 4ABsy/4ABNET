"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers";
import { acceptInviteAction, type ActionState } from "@/app/[locale]/admin/actions";
import { ShieldIcon } from "@/components/icons";

const ERROR_KEYS: Record<string, string> = {
  inviteInvalid: "admin.admins.inviteInvalid",
  weak: "admin.setup.weak",
  mismatch: "admin.setup.mismatch",
  emailTaken: "admin.admins.emailTaken",
  validation: "errors.validation",
  rateLimited: "errors.rateLimited",
};

export function AcceptInviteForm({
  locale,
  token,
  name,
  email,
}: {
  locale: string;
  token: string;
  name: string;
  email: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ActionState, FormData>(acceptInviteAction, {});
  const errorKey = state.error ? (ERROR_KEYS[state.error] ?? "errors.generic") : null;

  return (
    <form action={action} className="card p-6 sm:p-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldIcon size={22} />
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.admins.acceptTitle")}</h1>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted">{t("admin.admins.acceptBody")}</p>

      <dl className="mt-5 grid gap-3 rounded-xl bg-page p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{t("admin.admins.name")}</dt>
          <dd className="font-semibold">{name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("admin.admins.email")}</dt>
          <dd className="font-semibold ltr-value" dir="ltr">{email}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-password" className="label">{t("admin.admins.password")}</label>
          <input id="invite-password" name="password" type="password" required minLength={12} maxLength={200} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="invite-confirm" className="label">{t("admin.admins.confirmPassword")}</label>
          <input id="invite-confirm" name="confirmPassword" type="password" required minLength={12} maxLength={200} className="input" autoComplete="new-password" />
        </div>
      </div>
      <p className="hint">{t("admin.setup.passwordHint")}</p>

      {errorKey ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          {t(errorKey)}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full">
        {pending ? t("common.loading") : t("admin.admins.createAccount")}
      </button>
    </form>
  );
}
