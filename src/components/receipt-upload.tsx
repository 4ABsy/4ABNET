"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n, useToast } from "@/components/providers";
import { ReceiptIcon } from "@/components/icons";

export function ReceiptUpload({ reference }: { reference: string }) {
  const { t } = useI18n();
  const { notify } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError(t("errors.validation"));
      return;
    }
    // Keep in sync with MAX_UPLOAD_MB (default 4 MB, see .env.example).
    if (file.size > 4 * 1024 * 1024) {
      setError(t("errors.uploadSize"));
      return;
    }
    const formData = new FormData();
    formData.append("receipt", file);
    setUploading(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(reference)}/receipt`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as { code?: string; reason?: string };
      if (!response.ok) {
        setError(
          payload.reason === "file-too-large"
            ? t("errors.uploadSize")
            : payload.reason === "unsupported-file-type"
              ? t("errors.uploadType")
              : t("order.receiptError"),
        );
        return;
      }
      notify(t("order.receiptUploaded"), "success");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError(t("order.receiptError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="mt-4">
      <label htmlFor="receipt-file" className="label">{t("order.uploadReceipt")}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="receipt-file"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="input file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-ink"
          required
        />
        <button type="submit" disabled={uploading} className="btn btn-primary shrink-0">
          <ReceiptIcon size={17} />
          {uploading ? t("order.uploading") : t("order.uploadReceipt")}
        </button>
      </div>
      <p className="hint">{t("order.receiptHint")}</p>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft p-2 text-xs font-semibold text-danger">{error}</p>
      ) : null}
    </form>
  );
}
