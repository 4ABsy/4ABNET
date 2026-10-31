import "server-only";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/constants";

export async function getCustomerOrder(reference: string) {
  return prisma.order.findUnique({
    where: { reference },
    include: {
      items: true,
      payment: true,
      receipts: { orderBy: { uploadedAt: "desc" } },
      history: { orderBy: { createdAt: "asc" } },
      inventory: {
        where: { status: "ASSIGNED" },
        select: {
          id: true,
          activationCode: true,
          qrPath: true,
          instructions: true,
          deliveredAt: true,
        },
      },
    },
  });
}

export async function getAdminOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { inventory: { orderBy: { createdAt: "asc" } } } },
      payment: true,
      receipts: { orderBy: { uploadedAt: "desc" } },
      history: { orderBy: { createdAt: "asc" }, include: { admin: { select: { name: true } } } },
      customer: true,
      inventory: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;

/** A delivered order exposes activation data; before delivery nothing is rendered. */
export function deliveredUnits(order: CustomerOrder) {
  if (order.status !== "DELIVERED") return [];
  return order.inventory.filter((unit) => unit.deliveredAt);
}

export function orderStatusMessageKey(status: string): string {
  if (status === "AWAITING_PAYMENT") return "order.awaitingPaymentNote";
  if (status === "PAYMENT_REVIEW") return "order.receiptReviewNote";
  if (status === "CONFIRMED") return "order.paymentVerifiedNote";
  if (status === "DELIVERED") return "order.deliveryReady";
  return "order.deliveryPending";
}

export function localizeOrderCurrency(_locale: Locale) {
  return "TRY";
}
