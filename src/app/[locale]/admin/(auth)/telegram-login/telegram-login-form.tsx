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

export function TelegramLoginForm({
  locale,
  configured,
  botUsername,
}: {
  locale: string;
  configured: boolean;
  botUsername?: string | null;
}) {
  const { t } = useI18n();
  const [initData, setInitData] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
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
      <p className="mt-6 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning">
        {t("telegram.botNotConfigured")}
      </p>
    );
  }

  if (!initData) {
    return (
      <div className="mt-6">
        <p className="text-xs leading-6 text-muted">{t("telegram.notInTelegram")}</p>
        {botUsername ? (
          <a
            href={`https://t.me/${encodeURIComponent(botUsername)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm mt-4"
          >
            <TelegramIcon size={15} /> {t("telegram.openBot")}
          </a>
        ) : null}
      </div>
    );
  }

  async function submit() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ initData }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        redirect?: string;
        code?: string;
      };
      if (response.ok && payload.redirect) {
        setState("success");
        setMessage(t("telegram.adminLoginSuccess"));
        window.location.assign(payload.redirect);
        return;
      }
      setState("error");
      if (response.status === 429) setMessage(t("errors.rateLimited"));
      else if (response.status === 403) setMessage(t("telegram.adminLoginNotLinked"));
      else if (response.status === 503) setMessage(t("telegram.botNotConfigured"));
      else setMessage(t("telegram.adminLoginFailed"));
    } catch {
      setState("error");
      setMessage(t("common.somethingWentWrong"));
    }
  }

  return (
    <div className="mt-6">
      {message ? (
        <p
          role="status"
          className={`mb-4 rounded-xl p-3 text-xs font-semibold ${
            state === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={state === "loading" || state === "success"}
        className="btn btn-primary w-full"
      >
        <TelegramIcon size={17} />
        {state === "loading" ? t("common.loading") : t("telegram.adminLoginCta")}
      </button>
      <p className="hint mt-3">{t("telegram.adminLoginBody")}</p>
    </div>
  );
}
