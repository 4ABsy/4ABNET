"use client";

import { useState } from "react";
import { useI18n, useToast } from "@/components/providers";
import { CopyIcon } from "@/components/icons";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          notify(t("common.copied"), "success");
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          notify(t("common.somethingWentWrong"), "error");
        }
      }}
    >
      <CopyIcon size={15} />
      {copied ? t("common.copied") : label || t("common.copy")}
    </button>
  );
}
