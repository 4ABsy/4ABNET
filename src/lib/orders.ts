import "server-only";
import { Prisma, type Coupon, type Order, type OrderItem, type Payment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  canTransition,
  PAYMENT_METHODS,
  RESERVATION_HOURS,
  type Locale,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/constants";
import { hashToken, newToken } from "@/lib/auth";
import { createOrderAccessToken } from "@/lib/order-token";
import { lineTotal } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { notifyCustomerStatus } from "@/lib/notifications";
import { getSettings, settingBool } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";
import { pickTranslation } from "@/lib/catalog";
import { checkCoupon } from "@/lib/coupons";
import { normalizeCouponCode } from "@/lib/coupon-rules";

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export class OrderError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  status: number;
  constructor(code: string, status = 400, meta?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

export type Actor = {
  type: "ADMIN" | "SYSTEM" | "TELEGRAM";
  adminId?: string | null;
  ip?: string | null;
};

export function generateReference(): string {
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return `4AB-${result}`;
}

/** Accept local Turkish formats and international numbers; return E.164-ish. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 32) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.includes("+") && !cleaned.startsWith("+")) return null;
  let digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("5")) return `+90${digits}`;
  return `+${digits}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return "•••";
  return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}

export type CreateOrderInput = {
  items: { productId: string; quantity: number }[];
  name: string;
  phone: string;
  locale: Locale;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
  note?: string;
  couponCode?: string;
  ip?: string | null;
};

export type CreatedOrder = {
  order: Order;
  reference: string;
  accessToken: string;
  duplicate?: boolean;
};

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const settings = await getSettings();
  if (settingBool(settings, SETTING_KEYS.maintenanceMode)) throw new OrderError("MAINTENANCE", 503);
  if (!settingBool(settings, SETTING_KEYS.ordersEnabled)) throw new OrderError("ORDERS_PAUSED", 503);
  if (!settingBool(settings, SETTING_KEYS.codEnabled) && input.paymentMethod === "CASH_ON_DELIVERY") {
    throw new OrderError("METHOD_DISABLED", 400);
  }
  if (!settingBool(settings, SETTING_KEYS.bankTransferEnabled) && input.paymentMethod === "BANK_TRANSFER") {
    throw new OrderError("METHOD_DISABLED", 400);
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) throw new OrderError("PHONE_INVALID", 400);
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new OrderError("NAME_INVALID", 400);
  if (!input.items.length || input.items.length > 20) throw new OrderError("ITEMS_INVALID", 400);

  const merged = new Map<string, number>();
  for (const item of input.items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new OrderError("QUANTITY_INVALID", 400);
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  const trackingToken = newToken(32);
  const trackingTokenHash = hashToken(trackingToken);
  const reservationUntil = new Date(Date.now() + RESERVATION_HOURS * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateReference();
    try {
      const order = await prisma.$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: [...merged.keys()] } },
            include: { translations: true },
          });
          if (products.length !== merged.size) throw new OrderError("PRODUCT_UNAVAILABLE", 409);

          let subtotal = 0;
          const snapshots: {
            productId: string;
            productName: string;
            productSlug: string;
            dataAllowance: string | null;
            validityDays: number | null;
            unitPriceMinor: number;
            quantity: number;
            lineTotalMinor: number;
            stock: number;
          }[] = [];

          for (const [productId, quantity] of merged) {
            const product = products.find((p) => p.id === productId);
            if (!product || !product.isActive || product.isArchived) {
              throw new OrderError("PRODUCT_UNAVAILABLE", 409);
            }
            if (!Number.isInteger(product.priceMinor) || product.priceMinor <= 0) {
              throw new OrderError("PRODUCT_UNAVAILABLE", 409);
            }
            const translation = pickTranslation(product.translations, input.locale);
            const available = await tx.inventoryUnit.count({
              where: { productId, status: "AVAILABLE" },
            });
            if (available < quantity) {
              throw new OrderError("NO_STOCK", 409, {
                productId,
                productName: translation?.name ?? product.slug,
                available,
              });
            }
            const total = lineTotal(product.priceMinor, quantity);
            subtotal += total;
            snapshots.push({
              productId,
              productName: translation?.name ?? product.slug,
              productSlug: product.slug,
              dataAllowance: product.dataAllowance,
              validityDays: product.validityDays,
              unitPriceMinor: product.priceMinor,
              quantity,
              lineTotalMinor: total,
              stock: available,
            });
          }

          const customer = await tx.customer.upsert({
            where: { phone: normalizedPhone },
            create: { name, phone: normalizedPhone, locale: input.locale },
            update: { name, locale: input.locale },
          });

          const requestedCoupon = input.couponCode?.trim()
            ? normalizeCouponCode(input.couponCode)
            : null;
          let coupon: Coupon | null = null;
          let discountMinor = 0;
          if (requestedCoupon) {
            const result = await checkCoupon(tx, requestedCoupon, subtotal, {
              customerPhone: normalizedPhone,
            });
            if (!result.ok) {
              throw new OrderError(result.code, 400, {
                ...(result.minSubtotalMinor !== undefined
                  ? { minSubtotalMinor: result.minSubtotalMinor }
                  : {}),
              });
            }
            coupon = result.coupon;
            discountMinor = result.discountMinor;
          }
          const totalMinor = subtotal - discountMinor;
          // A fully discounted order has nothing to pay, so it goes straight to
          // manual confirmation instead of waiting for a bank transfer.
          const isFree = totalMinor === 0;

          const initialStatus: OrderStatus =
            input.paymentMethod === "CASH_ON_DELIVERY" || isFree
              ? "AWAITING_CONFIRMATION"
              : "AWAITING_PAYMENT";

          const order = await tx.order.create({
            data: {
              reference,
              trackingTokenHash,
              customerId: customer.id,
              status: initialStatus,
              paymentStatus: isFree ? "VERIFIED" : "UNPAID",
              paymentMethod: input.paymentMethod,
              currency: "TRY",
              subtotalMinor: subtotal,
              discountMinor,
              totalMinor,
              couponId: coupon?.id ?? null,
              couponCode: coupon?.code ?? null,
              locale: input.locale,
              customerName: name,
              customerPhone: normalizedPhone,
              note: input.note?.slice(0, 1000) || null,
              idempotencyKey: input.idempotencyKey?.slice(0, 100) || null,
              inventoryReservedUntil: reservationUntil,
              items: {
                create: snapshots.map((s) => ({
                  productId: s.productId,
                  productName: s.productName,
                  productSlug: s.productSlug,
                  dataAllowance: s.dataAllowance,
                  validityDays: s.validityDays,
                  unitPriceMinor: s.unitPriceMinor,
                  quantity: s.quantity,
                  lineTotalMinor: s.lineTotalMinor,
                })),
              },
              payment: {
                create: {
                  method: input.paymentMethod,
                  amountMinor: totalMinor,
                  currency: "TRY",
                  status: isFree ? "VERIFIED" : "UNPAID",
                  ...(isFree
                    ? { reviewedAt: new Date(), reviewNote: "fully-discounted" }
                    : {}),
                },
              },
              history: {
                create: {
                  fromStatus: null,
                  toStatus: initialStatus,
                  actorType: "SYSTEM",
                  note: isFree ? "order-created-fully-discounted" : "order-created",
                },
              },
            },
            include: { items: true },
          });

          if (coupon) {
            // Conditional increment: two concurrent checkouts cannot exceed the
            // configured usage limit, and a rollback restores the count.
            const claimed = await tx.coupon.updateMany({
              where: {
                id: coupon.id,
                ...(coupon.usageLimit !== null
                  ? { usedCount: { lt: coupon.usageLimit } }
                  : {}),
              },
              data: { usedCount: { increment: 1 } },
            });
            if (claimed.count !== 1) throw new OrderError("COUPON_EXHAUSTED", 409);
          }

          // Reserve stock atomically. The status predicate prevents two orders
          // from receiving the same unit.
          for (const [productId, quantity] of merged) {
            const units = await tx.inventoryUnit.findMany({
              where: { productId, status: "AVAILABLE" },
              orderBy: { createdAt: "asc" },
              take: quantity,
              select: { id: true },
            });
            if (units.length < quantity) {
              throw new OrderError("NO_STOCK", 409, { productId });
            }
            const updated = await tx.inventoryUnit.updateMany({
              where: { id: { in: units.map((u) => u.id) }, status: "AVAILABLE" },
              data: {
                status: "RESERVED",
                orderId: order.id,
                reservedUntil: reservationUntil,
              },
            });
            if (updated.count !== quantity) {
              throw new OrderError("NO_STOCK", 409, { productId });
            }
          }

          return order;
        },
        { timeout: 15_000, maxWait: 10_000 },
      );

      await recordAudit({
        actorType: "SYSTEM",
        action: "order.created",
        entityType: "Order",
        entityId: order.id,
        details: {
          reference: order.reference,
          totalMinor: order.totalMinor,
          discountMinor: order.discountMinor,
          couponCode: order.couponCode,
          paymentMethod: order.paymentMethod,
          itemCount: order.items.length,
        },
        ip: input.ip ?? null,
      });

      return {
        order,
        reference: order.reference,
        accessToken: createOrderAccessToken(order.reference),
      };
    } catch (error) {
      if (error instanceof OrderError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = String(error.meta?.target ?? "");
          if (target.includes("idempotencyKey") && input.idempotencyKey) {
            const existing = await prisma.order.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
            });
            if (existing) {
              return {
                order: existing,
                reference: existing.reference,
                accessToken: createOrderAccessToken(existing.reference),
                duplicate: true,
              };
            }
          }
          if (target.includes("reference")) continue; // regenerate
        }
      }
      console.error("[orders] create failed", error);
      throw new OrderError("ORDER_FAILED", 500);
    }
  }
  throw new OrderError("ORDER_FAILED", 500);
}

export type CartQuote = {
  subtotalMinor: number;
  itemCount: number;
  lines: {
    productId: string;
    name: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
  }[];
};

/**
 * Re-price a cart on the server without touching stock or creating an order.
 * Used by the coupon preview endpoint so the client can never dictate prices.
 */
export async function quoteCart(
  items: { productId: string; quantity: number }[],
  locale: Locale,
): Promise<CartQuote> {
  if (!items.length || items.length > 20) throw new OrderError("ITEMS_INVALID", 400);

  const merged = new Map<string, number>();
  for (const item of items) {
    if (
      !item.productId ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    ) {
      throw new OrderError("QUANTITY_INVALID", 400);
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...merged.keys()] } },
    include: { translations: true },
  });
  if (products.length !== merged.size) throw new OrderError("PRODUCT_UNAVAILABLE", 409);

  let subtotalMinor = 0;
  let itemCount = 0;
  const lines: CartQuote["lines"] = [];
  for (const [productId, quantity] of merged) {
    const product = products.find((entry) => entry.id === productId);
    if (
      !product ||
      !product.isActive ||
      product.isArchived ||
      !Number.isInteger(product.priceMinor) ||
      product.priceMinor <= 0
    ) {
      throw new OrderError("PRODUCT_UNAVAILABLE", 409);
    }
    const total = lineTotal(product.priceMinor, quantity);
    subtotalMinor += total;
    itemCount += quantity;
    lines.push({
      productId,
      name: pickTranslation(product.translations, locale)?.name ?? product.slug,
      unitPriceMinor: product.priceMinor,
      quantity,
      lineTotalMinor: total,
    });
  }

  return { subtotalMinor, itemCount, lines };
}

async function releaseCouponUsage(
  tx: Prisma.TransactionClient,
  couponId: string | null,
): Promise<void> {
  if (!couponId) return;
  await tx.coupon.updateMany({
    where: { id: couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}

function assertTransition(order: Order, to: string) {
  if (!canTransition(order.status, to)) {
    throw new OrderError("INVALID_TRANSITION", 409, {
      from: order.status,
      to,
    });
  }
}

type OrderFull = Order & { items: OrderItem[]; payment: Payment | null };

async function loadOrder(orderId: string): Promise<OrderFull> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order) throw new OrderError("NOT_FOUND", 404);
  return order;
}

export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: Actor,
  note?: string,
): Promise<Order> {
  const order = await loadOrder(orderId);
  assertTransition(order, to);

  if (to === "CONFIRMED" && order.paymentMethod === "BANK_TRANSFER") {
    if (order.payment?.status !== "VERIFIED") throw new OrderError("PAYMENT_NOT_VERIFIED", 409);
  }
  if (to === "DELIVERED") {
    if (order.paymentMethod === "BANK_TRANSFER" && order.payment?.status !== "VERIFIED") {
      throw new OrderError("PAYMENT_NOT_VERIFIED", 409);
    }
    const assigned = await prisma.inventoryUnit.count({
      where: { orderId, status: "ASSIGNED" },
    });
    const required = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (assigned < required) throw new OrderError("INVENTORY_MISSING", 409, { assigned, required });
  }
  if (to === "CANCELLED" || to === "REFUNDED") {
    // Cancellation releases undelivered stock; refunds keep delivered eSIMs assigned.
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === "DELIVERED" ? {} : {}),
          ...(to === "CANCELLED" ? { inventoryReservedUntil: null } : {}),
        },
      });
      if (changed.count !== 1) throw new OrderError("ALREADY_UPDATED", 409);

      if (to === "CANCELLED") {
        // Return anything not yet delivered to sellable stock. Activation data
        // was never exposed to the customer for reserved/assigned-before-delivery units.
        const units = await tx.inventoryUnit.findMany({
          where: { orderId, status: { in: ["RESERVED", "ASSIGNED"] }, deliveredAt: null },
          select: { id: true },
        });
        if (units.length) {
          await tx.inventoryUnit.updateMany({
            where: { id: { in: units.map((u) => u.id) } },
            data: {
              status: "AVAILABLE",
              orderId: null,
              orderItemId: null,
              reservedUntil: null,
              assignedAt: null,
              assignedById: null,
            },
          });
        }
        await releaseCouponUsage(tx, order.couponId);
      }

      if (to === "DELIVERED") {
        await tx.inventoryUnit.updateMany({
          where: { orderId, status: "ASSIGNED", deliveredAt: null },
          data: { deliveredAt: new Date(), deliveredById: actor.adminId ?? null },
        });
      }

      if (to === "REFUNDED") {
        await tx.payment.updateMany({
          where: { orderId },
          data: { status: "REFUNDED", reviewedAt: new Date(), reviewedById: actor.adminId ?? null },
        });
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: to,
          actorType: actor.type,
          adminId: actor.adminId ?? null,
          note: note?.slice(0, 500) ?? null,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    },
    { timeout: 15_000 },
  );

  await recordAudit({
    adminId: actor.adminId ?? null,
    actorType: actor.type,
    action: `order.status.${to.toLowerCase()}`,
    entityType: "Order",
    entityId: orderId,
    details: { from: order.status, to, note: note?.slice(0, 200) ?? null },
    ip: actor.ip ?? null,
  });

  notifyCustomerStatus(orderId, to).catch((error) => {
    console.error("[orders] customer notification failed", error);
  });

  return updated;
}

export async function cancelOrder(orderId: string, actor: Actor, note?: string) {
  return transitionOrder(orderId, "CANCELLED", actor, note);
}

export async function startProcessing(orderId: string, actor: Actor) {
  return transitionOrder(orderId, "PROCESSING", actor, "processing-started");
}

export async function confirmPayment(
  orderId: string,
  actor: Actor,
  note?: string,
): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.status !== "PAYMENT_REVIEW") throw new OrderError("NOT_PAYABLE", 409);
  if (order.payment?.status !== "AWAITING_VERIFICATION") throw new OrderError("NOT_PAYABLE", 409);
  const receiptCount = await prisma.paymentReceipt.count({ where: { orderId } });
  if (!receiptCount) throw new OrderError("RECEIPT_REQUIRED", 409);

  await prisma.$transaction(
    async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: "PAYMENT_REVIEW" },
        data: { status: "CONFIRMED", paymentStatus: "VERIFIED", reviewedById: actor.adminId ?? null },
      });
      if (changed.count !== 1) throw new OrderError("ALREADY_UPDATED", 409);
      await tx.payment.updateMany({
        where: { orderId, status: "AWAITING_VERIFICATION" },
        data: {
          status: "VERIFIED",
          reviewedAt: new Date(),
          reviewedById: actor.adminId ?? null,
          reviewNote: note?.slice(0, 500) ?? null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "PAYMENT_REVIEW",
          toStatus: "CONFIRMED",
          actorType: actor.type,
          adminId: actor.adminId ?? null,
          note: "payment-verified",
        },
      });
    },
    { timeout: 15_000 },
  );

  await recordAudit({
    adminId: actor.adminId ?? null,
    actorType: actor.type,
    action: "payment.verified",
    entityType: "Order",
    entityId: orderId,
    details: { amountMinor: order.totalMinor, method: order.paymentMethod },
    ip: actor.ip ?? null,
  });
  notifyCustomerStatus(orderId, "CONFIRMED").catch(() => undefined);
}

export async function rejectPayment(
  orderId: string,
  actor: Actor,
  reason?: string,
): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.status !== "PAYMENT_REVIEW") throw new OrderError("NOT_PAYABLE", 409);
  if (order.payment?.status !== "AWAITING_VERIFICATION") throw new OrderError("NOT_PAYABLE", 409);

  await prisma.$transaction(
    async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: "PAYMENT_REVIEW" },
        data: { status: "AWAITING_PAYMENT", paymentStatus: "REJECTED", reviewedById: actor.adminId ?? null },
      });
      if (changed.count !== 1) throw new OrderError("ALREADY_UPDATED", 409);
      await tx.payment.updateMany({
        where: { orderId, status: "AWAITING_VERIFICATION" },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: actor.adminId ?? null,
          reviewNote: reason?.slice(0, 500) ?? null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "PAYMENT_REVIEW",
          toStatus: "AWAITING_PAYMENT",
          actorType: actor.type,
          adminId: actor.adminId ?? null,
          note: reason ? `payment-rejected: ${reason.slice(0, 200)}` : "payment-rejected",
        },
      });
    },
    { timeout: 15_000 },
  );

  await recordAudit({
    adminId: actor.adminId ?? null,
    actorType: actor.type,
    action: "payment.rejected",
    entityType: "Order",
    entityId: orderId,
    details: { reason: reason?.slice(0, 200) ?? null },
    ip: actor.ip ?? null,
  });
  notifyCustomerStatus(orderId, "AWAITING_PAYMENT").catch(() => undefined);
}

/** Mark the order as payment-under-review after a receipt is stored. */
export async function markReceiptSubmitted(orderId: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.status !== "AWAITING_PAYMENT" && order.status !== "PAYMENT_REVIEW") {
    throw new OrderError("INVALID_STATE", 409);
  }
  if (order.paymentMethod !== "BANK_TRANSFER") throw new OrderError("INVALID_METHOD", 409);
  if (order.status === "AWAITING_PAYMENT") {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: "AWAITING_PAYMENT" },
        data: { status: "PAYMENT_REVIEW", paymentStatus: "AWAITING_VERIFICATION" },
      });
      if (changed.count !== 1) throw new OrderError("ALREADY_UPDATED", 409);
      await tx.payment.updateMany({
        where: { orderId },
        data: { status: "AWAITING_VERIFICATION" },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: "AWAITING_PAYMENT",
          toStatus: "PAYMENT_REVIEW",
          actorType: "SYSTEM",
          note: "receipt-uploaded",
        },
      });
    });
    await recordAudit({
      actorType: "SYSTEM",
      action: "payment.receipt.uploaded",
      entityType: "Order",
      entityId: orderId,
      details: { reference: order.reference },
    });
    notifyCustomerStatus(orderId, "PAYMENT_REVIEW").catch(() => undefined);
  } else if (order.payment?.status === "REJECTED") {
    await prisma.payment.updateMany({
      where: { orderId },
      data: { status: "AWAITING_VERIFICATION" },
    });
  }
}

/**
 * Assign reserved or available units to order items. Each updateMany is
 * conditional on the current status, so two concurrent admins cannot assign
 * the same unit twice.
 */
export async function assignInventory(
  orderId: string,
  actor: Actor,
  options?: { unitId?: string },
): Promise<{ assigned: number; required: number }> {
  const order = await loadOrder(orderId);
  if (!["CONFIRMED", "PROCESSING", "AWAITING_CONFIRMATION"].includes(order.status)) {
    throw new OrderError("INVALID_STATE", 409);
  }
  if (order.paymentMethod === "BANK_TRANSFER" && order.payment?.status !== "VERIFIED") {
    throw new OrderError("PAYMENT_NOT_VERIFIED", 409);
  }
  const items = await prisma.orderItem.findMany({ where: { orderId }, include: { inventory: true } });
  let assignedTotal = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const item of items) {
        const already = item.inventory.filter((u) => u.status === "ASSIGNED").length;
        const need = item.quantity - already;
        if (need <= 0) continue;

        if (options?.unitId) {
          const unit = await tx.inventoryUnit.findUnique({ where: { id: options.unitId } });
          if (!unit || unit.productId !== item.productId) throw new OrderError("INVENTORY_MISMATCH", 409);
          if (!["AVAILABLE", "RESERVED"].includes(unit.status) || (unit.orderId && unit.orderId !== orderId)) {
            throw new OrderError("INVENTORY_MISMATCH", 409);
          }
          const changed = await tx.inventoryUnit.updateMany({
            where: {
              id: unit.id,
              status: { in: ["AVAILABLE", "RESERVED"] },
              OR: [{ orderId: null }, { orderId }],
            },
            data: {
              status: "ASSIGNED",
              orderId,
              orderItemId: item.id,
              assignedAt: new Date(),
              assignedById: actor.adminId ?? null,
              reservedUntil: null,
            },
          });
          if (changed.count !== 1) throw new OrderError("ASSIGNMENT_FAILED", 409);
          assignedTotal += 1;
          continue;
        }

        const reserved = await tx.inventoryUnit.findMany({
          where: { productId: item.productId, status: "RESERVED", orderId },
          orderBy: { createdAt: "asc" },
          take: need,
          select: { id: true },
        });
        const remaining = need - reserved.length;
        if (reserved.length) {
          const changed = await tx.inventoryUnit.updateMany({
            where: { id: { in: reserved.map((u) => u.id) }, status: "RESERVED", orderId },
            data: {
              status: "ASSIGNED",
              orderItemId: item.id,
              assignedAt: new Date(),
              assignedById: actor.adminId ?? null,
              reservedUntil: null,
            },
          });
          if (changed.count !== reserved.length) throw new OrderError("ASSIGNMENT_FAILED", 409);
          assignedTotal += changed.count;
        }
        if (remaining > 0) {
          const available = await tx.inventoryUnit.findMany({
            where: { productId: item.productId, status: "AVAILABLE" },
            orderBy: { createdAt: "asc" },
            take: remaining,
            select: { id: true },
          });
          const availableIds = available.map((u) => u.id);
          if (availableIds.length < remaining) throw new OrderError("INVENTORY_MISSING", 409);
          const changed = await tx.inventoryUnit.updateMany({
            where: { id: { in: availableIds }, status: "AVAILABLE" },
            data: {
              status: "ASSIGNED",
              orderId,
              orderItemId: item.id,
              assignedAt: new Date(),
              assignedById: actor.adminId ?? null,
              reservedUntil: null,
            },
          });
          if (changed.count !== availableIds.length) throw new OrderError("ASSIGNMENT_FAILED", 409);
          assignedTotal += changed.count;
        }
      }
    },
    { timeout: 15_000 },
  );

  if (order.status === "CONFIRMED" && assignedTotal > 0) {
    await transitionOrder(orderId, "PROCESSING", actor, "inventory-assigned");
  }

  await recordAudit({
    adminId: actor.adminId ?? null,
    actorType: actor.type,
    action: "inventory.assigned",
    entityType: "Order",
    entityId: orderId,
    details: { assigned: assignedTotal },
    ip: actor.ip ?? null,
  });

  const required = items.reduce((sum, item) => sum + item.quantity, 0);
  return { assigned: assignedTotal, required };
}

export async function deliverOrder(orderId: string, actor: Actor): Promise<Order> {
  const order = await loadOrder(orderId);
  if (!["CONFIRMED", "PROCESSING"].includes(order.status)) throw new OrderError("INVALID_STATE", 409);
  if (order.paymentMethod === "BANK_TRANSFER" && order.payment?.status !== "VERIFIED") {
    throw new OrderError("PAYMENT_NOT_VERIFIED", 409);
  }
  return transitionOrder(orderId, "DELIVERED", actor, "esim-delivered");
}

/** Release expired reservations and cancel abandoned unpaid orders. */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: { in: ["AWAITING_PAYMENT", "AWAITING_CONFIRMATION"] },
      inventoryReservedUntil: { lt: now },
    },
    select: { id: true, status: true, couponId: true },
    take: 50,
  });
  let count = 0;
  for (const order of expired) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const changed = await tx.order.updateMany({
            where: { id: order.id, status: order.status },
            data: { status: "CANCELLED", inventoryReservedUntil: null },
          });
          if (changed.count !== 1) return;
          await tx.inventoryUnit.updateMany({
            where: { orderId: order.id, status: { in: ["RESERVED", "ASSIGNED"] }, deliveredAt: null },
            data: {
              status: "AVAILABLE",
              orderId: null,
              orderItemId: null,
              reservedUntil: null,
              assignedAt: null,
              assignedById: null,
            },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "CANCELLED",
              actorType: "SYSTEM",
              note: "reservation-expired",
            },
          });
          await releaseCouponUsage(tx, order.couponId);
        },
        { timeout: 15_000 },
      );
      await recordAudit({
        actorType: "SYSTEM",
        action: "order.cancelled.reservation-expired",
        entityType: "Order",
        entityId: order.id,
      });
      count += 1;
    } catch (error) {
      console.error("[orders] failed to expire reservation", order.id, error);
    }
  }
  return count;
}

export async function submitReceiptRecord(input: {
  orderId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}) {
  const order = await loadOrder(input.orderId);
  const payment = order.payment;
  const receipt = await prisma.paymentReceipt.create({
    data: {
      orderId: input.orderId,
      paymentId: payment?.id ?? null,
      storagePath: input.storagePath,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
    },
  });
  await markReceiptSubmitted(input.orderId);
  return receipt;
}
