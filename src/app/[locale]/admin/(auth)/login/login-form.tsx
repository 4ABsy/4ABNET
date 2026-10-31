"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers";
import { loginAction, type ActionState } from "@/app/[locale]/admin/actions";
import { LogoutIcon, ShieldIcon } from "@/components/icons";

const ERROR_KEYS: Record<string, string> = {
  invalid: "admin.login.invalid",
  rateLimited: "admin.login.rateLimited",
  suspended: "admin.login.suspended",
};

export function LoginForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const errorKey = state.error ? (ERROR_KEYS[state.error] ?? "errors.generic") : null;

  return (
    <form action={action} className="card p-6 sm:p-8">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldIcon size={22} />
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.login.title")}</h1>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted">{t("admin.login.subtitle")}</p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="label">
            {t("common.email")}
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            className="input ltr-value"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="label">
            {t("common.password")}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            className="input"
          />
        </div>
      </div>

      {errorKey ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          {t(errorKey)}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full">
        <LogoutIcon size={17} className="icon-directional" />
        {pending ? t("common.loading") : t("admin.login.submit")}
      </button>
    </form>
  );
}
