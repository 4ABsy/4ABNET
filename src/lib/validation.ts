import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(10),
});

export const orderCreateSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(20),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  locale: z.enum(["ar", "en", "tr"]),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH_ON_DELIVERY"]),
  idempotencyKey: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
  couponCode: z.string().trim().min(1).max(32).optional(),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1).max(32),
  items: z.array(orderItemSchema).min(1).max(20),
});

export const trackSchema = z.object({
  reference: z.string().trim().min(4).max(32),
  phone: z.string().trim().min(7).max(32),
});

export const adminNoteSchema = z.object({
  orderId: z.string().min(1),
  note: z.string().max(1000),
});

export const emailSchema = z.string().trim().email().max(200).toLowerCase();
export const passwordSchema = z.string().min(12).max(200);

export const ownerSetupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  storeName: z.string().trim().min(2).max(120),
  telegramId: z.string().trim().max(32).optional(),
});
