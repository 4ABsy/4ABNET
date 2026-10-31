import { notFound } from "next/navigation";
import {
  LOCALE_NAMES,
  SETTING_KEYS,
  isLocale,
  type Locale,
} from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { getSettings, type StoreSettings } from "@/lib/settings";
import { telegramConfigStatus } from "@/lib/env";
import { storageStatus } from "@/lib/storage";
import { retryNotificationsAction, saveSettingsAction } from "@/app/[locale]/admin/actions";
import { AdminFlash } from "@/components/admin/flash";

export const dynamic = "force-dynamic";

function localizedEntry(settings: StoreSettings, key: string, code: Locale): string {
  const value = settings[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[code] ?? "";
  }
  return "";
}

function text(settings: StoreSettings, key: string): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function enabled(settings: StoreSettings, key: string): boolean {
  return settings[key] === true;
}

function LocalizedField({
  settings,
  settingKey,
  name,
  label,
  hint,
  rows = 2,
}: {
  settings: StoreSettings;
  settingKey: string;
  name: string;
  label: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-bold">{label}</legend>
      <div className="mt-2 grid gap-3 lg:grid-cols-3">
        {(["ar", "en", "tr"] as const).map((code) => (
          <div key={code}>
            <label htmlFor={`${name}-${code}`} className="label">
              {LOCALE_NAMES[code]}
            </label>
            <textarea
              id={`${name}-${code}`}
              name={`${name}_${code}`}
              defaultValue={localizedEntry(settings, settingKey, code)}
              rows={rows}
              dir={code === "ar" ? "rtl" : "ltr"}
              className="input"
            />
          </div>
        ))}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </fieldset>
  );
}

function Toggle({
  name,
  label,
  checked,
  hint,
}: {
  name: string;
  label: string;
  checked: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm font-semibold">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
      />
      <span>
        {label}
        {hint ? <span className="mt-0.5 block text-[11px] font-normal text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export default async function AdminSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string; sent?: string; failed?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  const canSettings = hasPermission(ctx, "settings.manage");
  const canContent =
    hasPermission(ctx, "content.manage") || hasPermission(ctx, "translations.manage");
  const canTelegram = hasPermission(ctx, "telegram.manage");
  if (!canSettings && !canContent && !canTelegram) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">{t("admin.noPermission")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.forbiddenBody")}</p>
      </div>
    );
  }

  const [settings, query] = await Promise.all([getSettings(), searchParams]);
  const telegram = telegramConfigStatus();
  const storage = storageStatus();
  const canEditContent = canSettings || canContent;

  return (
    <div>
      <AdminFlash
        locale={locale}
        ok={query.ok}
        error={query.error}
        sent={query.sent}
        failed={query.failed}
      />

      <div>
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.settings.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("admin.settings.localizedHint")}</p>
      </div>

      <div className="mt-4 grid gap-2">
        <p className="rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
          {t("admin.settings.bankDemoWarning")}
        </p>
        {!enabled(settings, SETTING_KEYS.ordersEnabled) ? (
          <p className="rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning">
            {t("admin.settings.ordersPausedWarning")}
          </p>
        ) : null}
        {enabled(settings, SETTING_KEYS.maintenanceMode) ? (
          <p className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
            {t("admin.settings.maintenanceWarning")}
          </p>
        ) : null}
        <p className="rounded-xl bg-page p-3 text-xs text-muted">
          {t("admin.settings.samplesWarning")} {t("admin.settings.currencyLocked")}
        </p>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="text-lg font-bold">{t("admin.settings.telegramStatus")}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold text-muted">TELEGRAM_BOT_TOKEN</dt>
            <dd className="mt-1">
              <span className={telegram.botToken ? "badge badge-success" : "badge badge-danger"}>
                {telegram.botToken ? t("admin.settings.telegramConfigured") : t("admin.settings.telegramMissing")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-muted">TELEGRAM_ADMIN_CHAT_ID</dt>
            <dd className="mt-1">
              <span className={telegram.adminChatId ? "badge badge-success" : "badge badge-danger"}>
                {telegram.adminChatId ? t("admin.settings.telegramConfigured") : t("admin.settings.telegramMissing")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-muted">TELEGRAM_BOT_USERNAME</dt>
            <dd className="mt-1">
              {telegram.botUsername ? (
                <a
                  href={`https://t.me/${encodeURIComponent(telegram.botUsername)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link ltr-value text-xs font-semibold"
                  dir="ltr"
                >
                  @{telegram.botUsername}
                </a>
              ) : (
                <span className="badge badge-danger">{t("admin.settings.telegramMissing")}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-muted">TELEGRAM_WEBHOOK_SECRET</dt>
            <dd className="mt-1">
              <span className={telegram.webhookSecret ? "badge badge-success" : "badge badge-danger"}>
                {telegram.webhookSecret ? t("admin.settings.telegramConfigured") : t("admin.settings.telegramMissing")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-muted">CRON_SECRET</dt>
            <dd className="mt-1">
              <span className={telegram.cronSecret ? "badge badge-success" : "badge badge-warning"}>
                {telegram.cronSecret ? t("admin.settings.telegramConfigured") : t("admin.settings.cronSecretMissing")}
              </span>
            </dd>
          </div>
        </dl>
        {!telegram.configured ? (
          <p className="mt-3 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
            {t("admin.settings.telegramMissingBody")}
          </p>
        ) : null}
        <p className="mt-3 rounded-xl bg-page p-3 text-xs leading-6 text-muted">
          {t("admin.settings.telegramCronHint")}
        </p>
        {canTelegram ? (
          <form action={retryNotificationsAction} className="mt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={`/${locale}/admin/settings`} />
            <button type="submit" className="btn btn-secondary btn-sm">
              {t("admin.settings.retryNotifications")}
            </button>
          </form>
        ) : null}
      </section>

      <section className="card mt-5 p-5">
        <h2 className="text-lg font-bold">{t("admin.settings.storageStatus")}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold text-muted">{t("admin.settings.storageBackend")}</dt>
            <dd className="mt-1">
              <span className={storage.backend === "supabase" ? "badge badge-success" : "badge badge-warning"}>
                {storage.backend === "supabase"
                  ? t("admin.settings.storageSupabase")
                  : t("admin.settings.storageLocal")}
              </span>
            </dd>
          </div>
          {storage.publicBucket ? (
            <div>
              <dt className="text-[11px] font-semibold text-muted">SUPABASE_PUBLIC_BUCKET</dt>
              <dd className="mt-1 ltr-value" dir="ltr">
                {storage.publicBucket}
              </dd>
            </div>
          ) : null}
          {storage.privateBucket ? (
            <div>
              <dt className="text-[11px] font-semibold text-muted">SUPABASE_PRIVATE_BUCKET</dt>
              <dd className="mt-1 ltr-value" dir="ltr">
                {storage.privateBucket}
              </dd>
            </div>
          ) : null}
        </dl>
        {storage.partial ? (
          <p className="mt-3 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
            {t("admin.settings.storageMisconfigured")}
          </p>
        ) : null}
        {storage.backend === "local" && storage.serverless ? (
          <p className="mt-3 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
            {t("admin.settings.storageServerlessWarning")}
          </p>
        ) : null}
      </section>

      {canEditContent || canSettings ? (
        <form action={saveSettingsAction} className="mt-5 space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={`/${locale}/admin/settings`} />

          {canSettings ? (
            <section className="card p-5">
              <h2 className="text-lg font-bold">{t("admin.settings.general")}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="settings-store-name" className="label">{t("admin.settings.storeName")}</label>
                  <input
                    id="settings-store-name"
                    name="storeName"
                    defaultValue={text(settings, SETTING_KEYS.storeName)}
                    required
                    maxLength={120}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="settings-logo" className="label">{t("admin.settings.logo")}</label>
                  <input
                    id="settings-logo"
                    name="logoUrl"
                    defaultValue={text(settings, SETTING_KEYS.logoUrl)}
                    dir="ltr"
                    className="input ltr-value"
                  />
                </div>
                <div>
                  <label htmlFor="settings-color" className="label">{t("admin.settings.primaryColor")}</label>
                  <input
                    id="settings-color"
                    name="primaryColor"
                    defaultValue={text(settings, SETTING_KEYS.primaryColor)}
                    pattern="#[0-9a-fA-F]{6}"
                    dir="ltr"
                    className="input ltr-value"
                  />
                </div>
                <div>
                  <label htmlFor="settings-currency" className="label">{t("admin.settings.currency")}</label>
                  <input
                    id="settings-currency"
                    defaultValue="TRY (â‚º)"
                    disabled
                    dir="ltr"
                    className="input ltr-value"
                  />
                  <p className="hint">{t("admin.settings.currencyLocked")}</p>
                </div>
                <div>
                  <label htmlFor="settings-whatsapp" className="label">{t("admin.settings.whatsapp")}</label>
                  <input
                    id="settings-whatsapp"
                    name="whatsapp"
                    defaultValue={text(settings, SETTING_KEYS.whatsapp)}
                    maxLength={60}
                    dir="ltr"
                    className="input ltr-value"
                  />
                </div>
                <div>
                  <label htmlFor="settings-email" className="label">{t("admin.settings.supportEmail")}</label>
                  <input
                    id="settings-email"
                    name="supportEmail"
                    type="email"
                    defaultValue={text(settings, SETTING_KEYS.supportEmail)}
                    dir="ltr"
                    className="input ltr-value"
                  />
                </div>
              </div>

              <div className="mt-4">
                <LocalizedField
                  settings={settings}
                  settingKey={SETTING_KEYS.tagline}
                  name="tagline"
                  label={t("admin.settings.tagline")}
                  rows={2}
                />
              </div>
              <div className="mt-4">
                <LocalizedField
                  settings={settings}
                  settingKey={SETTING_KEYS.announcement}
                  name="announcement"
                  label={t("admin.settings.announcement")}
                  rows={2}
                />
              </div>
              <div className="mt-4">
                <LocalizedField
                  settings={settings}
                  settingKey={SETTING_KEYS.supportHours}
                  name="supportHours"
                  label={t("admin.settings.supportHours")}
                  rows={2}
                />
              </div>
            </section>
          ) : null}

          {canEditContent || canSettings ? (
            <section className="card space-y-4 p-5">
              <h2 className="text-lg font-bold">{t("admin.settings.homeSections")}</h2>
              <LocalizedField
                settings={settings}
                settingKey={SETTING_KEYS.heroTitle}
                name="heroTitle"
                label={t("admin.settings.heroTitle")}
                rows={2}
              />
              <LocalizedField
                settings={settings}
                settingKey={SETTING_KEYS.heroSubtitle}
                name="heroSubtitle"
                label={t("admin.settings.heroSubtitle")}
                rows={3}
              />
              {canSettings ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle name="showOffers" label={t("admin.settings.showOffers")} checked={enabled(settings, SETTING_KEYS.showOffers)} />
                  <Toggle name="showFeatures" label={t("admin.settings.showFeatures")} checked={enabled(settings, SETTING_KEYS.showFeatures)} />
                  <Toggle name="showCategories" label={t("admin.settings.showCategories")} checked={enabled(settings, SETTING_KEYS.showCategories)} />
                  <Toggle name="showFeatured" label={t("admin.settings.showFeatured")} checked={enabled(settings, SETTING_KEYS.showFeatured)} />
                </div>
              ) : null}
            </section>
          ) : null}

          {canSettings ? (
            <section className="card space-y-4 p-5">
              <h2 className="text-lg font-bold">{t("admin.settings.store")}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle
                  name="ordersEnabled"
                  label={t("admin.settings.ordersEnabled")}
                  checked={enabled(settings, SETTING_KEYS.ordersEnabled)}
                />
                <Toggle
                  name="maintenanceMode"
                  label={t("admin.settings.maintenance")}
                  checked={enabled(settings, SETTING_KEYS.maintenanceMode)}
                  hint={t("admin.settings.maintenanceWarning")}
                />
              </div>
            </section>
          ) : null}

          {canSettings ? (
            <section className="card space-y-4 p-5">
              <h2 className="text-lg font-bold">{t("admin.settings.payments")}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle
                  name="bankTransferEnabled"
                  label={t("admin.settings.bankTransferEnabled")}
                  checked={enabled(settings, SETTING_KEYS.bankTransferEnabled)}
                />
                <Toggle
                  name="codEnabled"
                  label={t("admin.settings.codEnabled")}
                  checked={enabled(settings, SETTING_KEYS.codEnabled)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="settings-bank-name" className="label">{t("admin.settings.bankName")}</label>
                  <input
                    id="settings-bank-name"
                    name="bankName"
                    defaultValue={text(settings, SETTING_KEYS.bankName)}
                    maxLength={160}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="settings-account-name" className="label">{t("admin.settings.accountName")}</label>
                  <input
                    id="settings-account-name"
                    name="bankAccountName"
                    defaultValue={text(settings, SETTING_KEYS.bankAccountName)}
                    maxLength={160}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="settings-iban" className="label">{t("admin.settings.iban")}</label>
                  <input
                    id="settings-iban"
                    name="bankIban"
                    defaultValue={text(settings, SETTING_KEYS.bankIban)}
                    maxLength={40}
                    dir="ltr"
                    className="input ltr-value"
                  />
                </div>
              </div>
              <LocalizedField
                settings={settings}
                settingKey={SETTING_KEYS.bankInstructions}
                name="bankInstructions"
                label={t("admin.settings.instructions")}
                rows={3}
              />
            </section>
          ) : null}

          <section className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">{t("admin.settings.policies")}</h2>
            <p className="text-xs leading-6 text-muted">{t("admin.settings.policyHint")}</p>
            <LocalizedField
              settings={settings}
              settingKey={SETTING_KEYS.privacyPolicy}
              name="privacyPolicy"
              label={t("admin.settings.privacy")}
              rows={4}
            />
            <LocalizedField
              settings={settings}
              settingKey={SETTING_KEYS.terms}
              name="terms"
              label={t("admin.settings.terms")}
              rows={4}
            />
            <LocalizedField
              settings={settings}
              settingKey={SETTING_KEYS.refundPolicy}
              name="refundPolicy"
              label={t("admin.settings.refund")}
              rows={4}
            />
            <LocalizedField
              settings={settings}
              settingKey={SETTING_KEYS.retentionPolicy}
              name="retentionPolicy"
              label={t("admin.settings.retention")}
              rows={4}
            />
          </section>

          <button type="submit" className="btn btn-primary">{t("admin.settings.save")}</button>
        </form>
      ) : null}
    </div>
  );
}
