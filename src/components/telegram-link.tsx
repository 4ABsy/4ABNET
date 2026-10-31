"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers";
import { TelegramIcon } from "@/components/icons";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/**
 * Links a verified order to the Telegram account that opened this Mini App.
 * The initData string is verified on the server with the bot token; the client
 * never decides whether the user is authentic.
 */
export function TelegramLinkCard({
  reference = "",
  configured,
  botUsername,
}: {
  reference?: string;
  configured: boolean;
  botUsername?: string | null;
}) {
  const { locale, t } = useI18n();
  const [initData, setInitData] = useState<string | null>(null);
  const [ref, setRef] = useState(reference);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "linked" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    webApp.ready?.();
    webApp.expand?.();
    setInitData(webApp.initData?.trim() || null);
  }, []);

  if (!configured) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <TelegramIcon size={18} /> {t("telegram.title")}
        </h2>
        <p className="mt-2 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
          {t("telegram.botNotConfigured")}
        </p>
      </section>
    );
  }

  if (!initData) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <TelegramIcon size={18} /> {t("telegram.title")}
        </h2>
        <p className="mt-2 text-xs leading-6 text-muted">{t("telegram.notInTelegram")}</p>
        <p className="mt-2 text-xs leading-6 text-muted">{t("telegram.miniAppHint")}</p>
        {botUsername ? (
          <a
            href={`https://t.me/${encodeURIComponent(botUsername)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm mt-3"
          >
            <TelegramIcon size={15} /> @{botUsername}
          </a>
        ) : null}
      </section>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ initData, reference: ref, phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as { code?: string };
      if (response.ok) {
        setState("linked");
        setMessage(t("telegram.linked"));
      } else {
        setState("error");
        setMessage(
          response.status === 429 ? t("errors.rateLimited") : t("telegram.linkError"),
        );
        if (payload.code === "NOT_CONFIGURED") setMessage(t("telegram.botNotConfigured"));
      }
    } catch {
      setState("error");
      setMessage(t("common.somethingWentWrong"));
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <TelegramIcon size={18} /> {t("telegram.trackTitle")}
      </h2>
      <p className="mt-2 text-xs leading-6 text-muted">{t("telegram.verifyBody")}</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="tg-reference" className="label">
            {t("order.referenceLabel")}
          </label>
          <input
            id="tg-reference"
            value={ref}
            onChange={(event) => setRef(event.target.value.toUpperCase())}
            placeholder="4AB-XXXXXXXX"
            dir="ltr"
            maxLength={32}
            required
            className="input ltr-value font-bold tracking-wider"
          />
        </div>
        <div>
          <label htmlFor="tg-phone" className="label">
            {t("order.phoneLabel")}
          </label>
          <input
            id="tg-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("checkout.phonePlaceholder")}
            dir="ltr"
            maxLength={32}
            required
            className="input ltr-value"
          />
        </div>
        {message ? (
          <p
            role="status"
            className={`rounded-xl p-3 text-xs font-semibold ${
              state === "linked" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {message}
          </p>
        ) : null}
        <button type="submit" disabled={state === "loading"} className="btn btn-primary w-full sm:w-auto">
          {state === "loading" ? t("common.loading") : t("telegram.verifySubmit")}
        </button>
        <p className="hint">{t("telegram.trackBody")}</p>
        <p className="hint" lang={locale}>
          {t("telegram.miniAppHint")}
        </p>
      </form>
    </section>
  );
}
