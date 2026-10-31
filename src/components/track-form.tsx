"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n, useToast } from "@/components/providers";

export function TrackForm({ reference = "" }: { reference?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [ref, setRef] = useState(reference);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/orders/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reference: ref, phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as { reference?: string; code?: string };
      if (response.status === 429) {
        setError(t("order.trackingRateLimited"));
      } else if (!response.ok || !payload.reference) {
        setError(t("order.trackingInvalid"));
      } else {
        router.push(`/${locale}/orders/${payload.reference}`);
      }
    } catch {
      setError(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="track-reference" className="label">{t("order.referenceLabel")}</label>
          <input
            id="track-reference"
            value={ref}
            onChange={(event) => setRef(event.target.value.toUpperCase())}
            placeholder="4AB-XXXXXXXX"
            maxLength={32}
            required
            dir="ltr"
            className="input ltr-value font-bold tracking-wider"
          />
        </div>
        <div>
          <label htmlFor="track-phone" className="label">{t("order.phoneLabel")}</label>
          <input
            id="track-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("checkout.phonePlaceholder")}
            maxLength={32}
            required
            dir="ltr"
            className="input ltr-value"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">{error}</p>
      ) : null}
      <button type="submit" disabled={loading} className="btn btn-primary mt-5 w-full sm:w-auto">
        {loading ? t("common.loading") : t("order.trackButton")}
      </button>
      <p className="hint mt-3">{t("order.saveLink")}</p>
    </form>
  );
}
