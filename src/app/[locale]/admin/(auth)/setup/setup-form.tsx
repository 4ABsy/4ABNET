"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers";
import { setupOwnerAction, type ActionState } from "@/app/[locale]/admin/actions";
import { ShieldIcon } from "@/components/icons";

const ERROR_KEYS: Record<string, string> = {
  weak: "admin.setup.weak",
  mismatch: "admin.setup.mismatch",
  alreadyDone: "admin.setup.alreadyDone",
  validation: "errors.validation",
  emailTaken: "admin.admins.emailTaken",
  telegramTaken: "admin.telegramTaken",
  rateLimited: "errors.rateLimited",
};

export function SetupForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ActionState, FormData>(setupOwnerAction, {});
  const errorKey = state.error ? (ERROR_KEYS[state.error] ?? "errors.generic") : null;

  return (
    <form action={action} className="card p-6 sm:p-8">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldIcon size={22} />
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.setup.title")}</h1>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted">{t("admin.setup.subtitle")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="setup-name" className="label">{t("admin.setup.ownerName")}</label>
          <input id="setup-name" name="name" required minLength={2} maxLength={120} className="input" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="setup-store" className="label">{t("admin.setup.storeName")}</label>
          <input id="setup-store" name="storeName" required minLength={2} maxLength={120} defaultValue="4AB NET" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="setup-email" className="label">{t("admin.setup.ownerEmail")}</label>
          <input id="setup-email" name="email" type="email" required dir="ltr" className="input ltr-value" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="setup-password" className="label">{t("admin.setup.password")}</label>
          <input id="setup-password" name="password" type="password" required minLength={12} maxLength={200} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="setup-confirm" className="label">{t("admin.setup.confirmPassword")}</label>
          <input id="setup-confirm" name="confirmPassword" type="password" required minLength={12} maxLength={200} className="input" autoComplete="new-password" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="setup-telegram" className="label">{t("admin.admins.telegramId")}</label>
          <input
            id="setup-telegram"
            name="telegramId"
            inputMode="numeric"
            pattern="\d{5,20}"
            maxLength={20}
            dir="ltr"
            className="input ltr-value"
            placeholder="123456789"
          />
          <p className="hint">{t("admin.admins.telegramHint")}</p>
        </div>
      </div>
      <p className="hint">{t("admin.setup.passwordHint")}</p>

      {errorKey ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          {t(errorKey)}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full">
        {pending ? t("common.loading") : t("admin.setup.submit")}
      </button>
    </form>
  );
}
