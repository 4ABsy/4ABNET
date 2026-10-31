const ORDER_TONES: Record<string, string> = {
  AWAITING_CONFIRMATION: "badge-warning",
  AWAITING_PAYMENT: "badge-warning",
  PAYMENT_REVIEW: "badge-warning",
  CONFIRMED: "badge-brand",
  PROCESSING: "badge-brand",
  DELIVERED: "badge-success",
  CANCELLED: "badge-danger",
  REFUNDED: "badge-neutral",
};

const PAYMENT_TONES: Record<string, string> = {
  UNPAID: "badge-warning",
  AWAITING_VERIFICATION: "badge-warning",
  VERIFIED: "badge-success",
  REJECTED: "badge-danger",
  REFUNDED: "badge-neutral",
};

const INVENTORY_TONES: Record<string, string> = {
  AVAILABLE: "badge-success",
  RESERVED: "badge-warning",
  ASSIGNED: "badge-brand",
  REVOKED: "badge-danger",
};

export function StatusBadge({
  kind,
  status,
  label,
}: {
  kind: "order" | "payment" | "inventory";
  status: string;
  label: string;
}) {
  const tone =
    kind === "order"
      ? ORDER_TONES[status]
      : kind === "payment"
        ? PAYMENT_TONES[status]
        : INVENTORY_TONES[status];
  return <span className={tone ?? "badge-neutral"}>{label}</span>;
}
