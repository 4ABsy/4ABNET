import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { createI18n } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { escapeHtml, miniAppUrl, sendTelegramMessage, telegramMiniAppButton } from "@/lib/telegram";

async function adminLocale(chatId: string) {
  const chat = await prisma.telegramChat.findUnique({ where: { chatId } });
  return normalizeLocale(chat?.locale);
}

/**
 * Notify the configured administrative Telegram chat about a new order.
 * This function is fire-and-forget: it queues the notification and returns
 * immediately without waiting for the Telegram API response. This prevents
 * blocking order creation requests when Telegram is slow or rate-limited.
 * The notification is persisted and retried automatically via
 * `retryPendingNotifications`.
 */
export async function notifyAdminsNewOrder(orderId: string): Promise<void> {
  const chatId = env.telegramAdminChatId;
  if (!chatId || !env.isTelegramConfigured) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order) return;
  const locale = await adminLocale(chatId);
  const { t, money } = createI18n(locale);
  const lines = [
    `🛒 <b>${t("admin.orders.title")}</b>`,
    `${t("order.reference")}: <code>${escapeHtml(order.reference)}</code>`,
    `${t("order.customer")}: ${escapeHtml(order.customerName)}`,
    `${t("order.phone")}: <code>${escapeHtml(order.customerPhone)}</code>`,
    ...(order.discountMinor > 0
      ? [
          `${t("common.subtotal")}: ${money(order.subtotalMinor)}`,
          `${t("common.discount")}${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}: −${money(order.discountMinor)}`,
        ]
      : []),
    `${t("order.total")}: <b>${money(order.totalMinor)}</b>`,
    `${t("order.paymentMethod")}: ${t(`paymentMethod.${order.paymentMethod}`)}`,
    `${t("order.paymentStatus")}: ${t(`paymentStatus.${order.paymentStatus}`)}`,
    "",
    ...order.items.map(
      (item) => `• ${escapeHtml(item.productName)} × ${item.quantity} — ${money(item.lineTotalMinor)}`,
    ),
  ];
  const text = lines.join("\n");
  const viewUrl = `${env.siteUrl}/${locale}/admin/orders/${order.id}`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: `✅ ${t("admin.orders.confirmAction")}`, callback_data: `ord:confirm:${order.id}` },
        { text: `❌ ${t("admin.orders.cancelAction")}`, callback_data: `ord:cancel:${order.id}` },
      ],
      ...(viewUrl.startsWith("https://")
        ? [[{ text: `🔗 ${t("admin.orders.view")}`, url: viewUrl }]]
        : []),
    ],
  };
  // Fire-and-forget: don't await sendTelegramMessage to avoid blocking
  sendTelegramMessage(chatId, text, {
    kind: "admin-new-order",
    replyMarkup: keyboard,
    disablePreview: true,
  }).catch((error) => {
    // Log but never throw - order creation must not fail due to Telegram issues
    console.error("[notifications] admin new order failed", error);
  });
}

/** Notify a customer when their order status changes, if they linked Telegram.
 * This function is fire-and-forget: it queues the notification and returns
 * immediately without waiting for the Telegram API response. This prevents
 * blocking order status transition requests when Telegram is slow or
 * rate-limited. The notification is persisted and retried automatically via
 * `retryPendingNotifications`.
 */
export async function notifyCustomerStatus(orderId: string, status: string): Promise<void> {
  if (!env.isTelegramConfigured) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order?.customer.telegramId) return;
  const locale = normalizeLocale(order.locale);
  const { t } = createI18n(locale);
  const text = [
    `<b>4AB NET</b>`,
    `${t("order.reference")}: <code>${escapeHtml(order.reference)}</code>`,
    `${t("order.status")}: <b>${t(`status.${status}`)}</b>`,
    status === "DELIVERED"
      ? t("order.deliveryReady")
      : status === "PAYMENT_REVIEW"
        ? t("order.receiptReviewNote")
        : status === "CONFIRMED"
          ? t("order.paymentVerifiedNote")
          : status === "AWAITING_PAYMENT"
            ? t("order.awaitingPaymentNote")
            : t("order.secureDeliveryNote"),
    "",
    `${t("order.currencyNote")} ${formatMoney(order.totalMinor, locale)}`,
  ].join("\n");
  const trackButton = telegramMiniAppButton(t("order.trackOrder"), miniAppUrl(locale, "/track"));
  const keyboard = trackButton
    ? { inline_keyboard: [[trackButton]] }
    : undefined;
  // Fire-and-forget: don't await sendTelegramMessage to avoid blocking
  sendTelegramMessage(order.customer.telegramId, text, {
    kind: "customer-status",
    replyMarkup: keyboard,
    disablePreview: true,
  }).catch((error) => {
    // Log but never throw - order status changes must not fail due to Telegram issues
    console.error("[notifications] customer status failed", error);
  });
}
