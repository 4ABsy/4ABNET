import type { Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";

const SUCCESS_KEYS: Record<string, string> = {
  saved: "common.saved",
  created: "common.created",
  updated: "common.updated",
  deleted: "common.deleted",
  statusUpdated: "admin.orders.statusUpdated",
  paymentVerified: "admin.orders.paymentVerified",
  paymentRejected: "admin.orders.paymentRejected",
  deliverySuccess: "admin.orders.deliverySuccess",
  assigned: "admin.orders.assignedCount",
  inventoryCreated: "admin.inventory.created",
  revokedMsg: "admin.inventory.revokedMsg",
  released: "admin.inventory.released",
  permissionsSaved: "admin.admins.permissionsSaved",
  retry: "admin.settings.retryResult",
};

const ERROR_KEYS: Record<string, string> = {
  forbidden: "errors.forbidden",
  unauthorized: "errors.unauthorized",
  rateLimited: "errors.rateLimited",
  notFound: "errors.notFound",
  validation: "errors.validation",
  duplicateValue: "admin.duplicateValue",
  telegramTaken: "admin.telegramTaken",
  invitePending: "admin.invitePending",
  ownerProtected: "admin.admins.ownerProtected",
  cannotSelf: "admin.admins.cannotSelf",
  permissionRequired: "admin.admins.permissionRequired",
  emailTaken: "admin.admins.emailTaken",
  deleteBlocked: "admin.deleteBlocked",
  uploadError: "admin.uploadError",
  priceInvalid: "admin.products.priceInvalid",
  originalPriceInvalid: "admin.products.originalPriceInvalid",
  couponCodeInvalid: "admin.coupons.codeInvalid",
  couponValueInvalid: "admin.coupons.valueInvalid",
  couponDateInvalid: "admin.coupons.dateInvalid",
  couponCodeTaken: "admin.coupons.codeTaken",
  couponDeleteBlocked: "admin.coupons.deleteBlocked",
  usageLimitTooLow: "admin.coupons.usageLimitTooLow",
  noProduct: "admin.inventory.noProduct",
  qrOnlySingle: "admin.inventory.qrOnlySingle",
  singleOnly: "admin.inventory.singleOnly",
  cannotDeleteAssigned: "admin.inventory.cannotDeleteAssigned",
  PAYMENT_NOT_VERIFIED: "admin.orders.deliveryRequiresPayment",
  RECEIPT_REQUIRED: "admin.orders.needsReceipt",
  INVENTORY_MISSING: "admin.orders.inventoryMissing",
  INVENTORY_MISMATCH: "admin.orders.inventoryMissing",
  ASSIGNMENT_FAILED: "admin.orders.inventoryMissing",
  NOT_PAYABLE: "admin.orders.notPayable",
  INVALID_STATE: "admin.orders.noActions",
  INVALID_TRANSITION: "admin.orders.noActions",
  ALREADY_UPDATED: "admin.orders.noActions",
  generic: "errors.generic",
};

export function AdminFlash({
  locale,
  ok,
  error,
  count,
  sent,
  failed,
}: {
  locale: Locale;
  ok?: string;
  error?: string;
  count?: string;
  sent?: string;
  failed?: string;
}) {
  const { t } = createI18n(locale);

  if (error) {
    const key = ERROR_KEYS[error] ?? "errors.generic";
    return (
      <div role="alert" className="mb-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm font-semibold text-danger">
        {t(key)}
      </div>
    );
  }

  if (!ok) return null;
  const key = SUCCESS_KEYS[ok];
  if (!key) return null;

  const vars: Record<string, string | number> = {};
  if (count !== undefined) vars.count = Number(count) || 0;
  if (sent !== undefined) vars.sent = Number(sent) || 0;
  if (failed !== undefined) vars.failed = Number(failed) || 0;

  return (
    <div role="status" className="mb-4 rounded-xl border border-success/20 bg-success-soft p-3 text-sm font-semibold text-success">
      {t(key, vars)}
    </div>
  );
}
