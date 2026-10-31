"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  SETTING_KEYS,
  isPermission,
  normalizeLocale,
  type Permission,
} from "@/lib/constants";
import {
  type AdminContext,
  createAdminSession,
  getAdminSession,
  hashPassword,
  hashToken,
  isOwner,
  newToken,
  revokeCurrentSession,
  clearSessionCookie,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { emailSchema, ownerSetupSchema, passwordSchema } from "@/lib/validation";
import { auditAdmin, recordAudit } from "@/lib/audit";
import {
  assignInventory,
  cancelOrder,
  confirmPayment,
  deliverOrder,
  OrderError,
  rejectPayment,
  startProcessing,
  transitionOrder,
} from "@/lib/orders";
import { savePrivateFile, savePublicImage, UploadError } from "@/lib/storage";
import { retryPendingNotifications } from "@/lib/telegram";
import { parseJsonArray } from "@/lib/json";
import { setSetting } from "@/lib/settings";
import { invalidateStoreCache } from "@/lib/store-cache";
import { COUPON_TYPES, isValidCouponCode, normalizeCouponCode } from "@/lib/coupon-rules";

export type ActionState = {
  error?: string;
  ok?: boolean;
  token?: string;
  expiresAt?: string;
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function raw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

function intOrNull(formData: FormData, name: string): number | null {
  const value = field(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function formLocale(formData: FormData) {
  return normalizeLocale(field(formData, "locale") || field(formData, "lang"));
}

/** Only allow redirects inside this locale's admin area. */
function adminReturnPath(formData: FormData, fallback: string): string {
  const locale = formLocale(formData);
  const requested = field(formData, "returnTo");
  const base = `/${locale}/admin`;
  if (requested && requested.startsWith(base) && !requested.startsWith("//")) {
    return requested;
  }
  return `${base}${fallback}`;
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(path, "http://local");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

function fail(formData: FormData, fallback: string, code: string): never {
  redirect(withQuery(adminReturnPath(formData, fallback), { error: code }));
}

function done(
  formData: FormData,
  fallback: string,
  params: Record<string, string | number | undefined> = { ok: "saved" },
): never {
  // Any successful admin write may change storefront data, so drop this
  // instance's cached reads before redirecting back.
  invalidateStoreCache();
  redirect(withQuery(adminReturnPath(formData, fallback), params));
}

async function ip(): Promise<string> {
  const h = await headers();
  return clientIpFromHeaders(h);
}

function userAgent(): string | null {
  return null;
}

async function guard(formData: FormData, permission: Permission): Promise<AdminContext> {
  const locale = formLocale(formData);
  const ctx = await getAdminSession();
  if (!ctx) redirect(`/${locale}/admin/login`);
  if (!hasPermissionSafe(ctx, permission)) {
    fail(formData, "", "forbidden");
  }
  return ctx;
}

function hasPermissionSafe(ctx: AdminContext, permission: Permission): boolean {
  if (ctx.role === "OWNER") return true;
  return ctx.permissions.includes(permission);
}

async function guardAny(formData: FormData, permissions: Permission[]): Promise<AdminContext> {
  const locale = formLocale(formData);
  const ctx = await getAdminSession();
  if (!ctx) redirect(`/${locale}/admin/login`);
  if (!permissions.some((permission) => hasPermissionSafe(ctx, permission))) {
    fail(formData, "", "forbidden");
  }
  return ctx;
}

async function ownerGuard(formData: FormData): Promise<AdminContext> {
  const locale = formLocale(formData);
  const ctx = await getAdminSession();
  if (!ctx) redirect(`/${locale}/admin/login`);
  if (!isOwner(ctx)) fail(formData, "", "forbidden");
  return ctx;
}

function safeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/brand/") || trimmed.startsWith("/icons/")) {
    return trimmed.slice(0, 500);
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString().slice(0, 500);
  } catch {
    return null;
  }
  return null;
}

function imageFromForm(formData: FormData, existingField = "existingImage"): Promise<string | null> {
  const file = formData.get("imageFile");
  const existing = safeImageUrl(field(formData, existingField));
  if (file instanceof File && file.size > 0) {
    return savePublicImage(file).then((saved) => saved.url);
  }
  return Promise.resolve(existing);
}

function localizedField(formData: FormData, key: string): Record<string, string> {
  return {
    ar: raw(formData, `${key}_ar`).trim(),
    en: raw(formData, `${key}_en`).trim(),
    tr: raw(formData, `${key}_tr`).trim(),
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

function priceToMinor(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  return Math.round(amount * 100);
}

function lines(value: string, max = 30): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((line) => line.slice(0, 120));
}

function dateOrNull(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Accept "199.90" or "199,90" and return integer kuruş. */
function amountToMinor(value: string, allowZero = false): number | null {
  if (!value) return allowZero ? 0 : null;
  const normalized = value.replace(",", ".").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return null;
  if (!allowZero && amount <= 0) return null;
  return Math.round(amount * 100);
}

/** "12.5" -> 1250 basis points (12.5%). */
function percentToBasisPoints(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const percent = Number(normalized);
  if (!Number.isFinite(percent)) return null;
  return Math.round(percent * 100);
}

/**
 * Coupon schedules are entered in the store's timezone (Europe/Istanbul,
 * UTC+3 year-round) so the server timezone cannot shift the boundary.
 */
function couponDate(value: string): Date | null {
  if (!value) return null;
  const isLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
  const normalized = isLocal
    ? `${value.length === 16 ? `${value}:00` : value}+03:00`
    : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

// ---------------------------------------------------------------------------
// Authentication and owner setup
// ---------------------------------------------------------------------------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = formLocale(formData);
  const emailRaw = field(formData, "email").toLowerCase();
  const password = raw(formData, "password");
  const address = await ip();
  const rate = rateLimit(`admin:login:${address}:${emailRaw}`, 8, 15 * 60_000);
  if (!rate.allowed) return { error: "rateLimited" };

  const parsed = emailSchema.safeParse(emailRaw);
  if (!parsed.success || !password) return { error: "invalid" };

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data } });
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;
  if (!admin || !valid) {
    await recordAudit({
      adminId: admin?.id ?? null,
      action: "admin.login.failed",
      entityType: "AdminUser",
      entityId: admin?.id ?? null,
      success: false,
      ip: address,
    });
    return { error: "invalid" };
  }
  if (admin.status !== "ACTIVE") {
    await recordAudit({
      adminId: admin.id,
      action: "admin.login.suspended",
      entityType: "AdminUser",
      entityId: admin.id,
      success: false,
      ip: address,
    });
    return { error: "suspended" };
  }

  const h = await headers();
  const session = await createAdminSession(admin.id, {
    ip: address,
    userAgent: h.get("user-agent") ?? userAgent(),
  });
  await setSessionCookie(session.token);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    adminId: admin.id,
    action: "admin.login",
    entityType: "AdminUser",
    entityId: admin.id,
    ip: address,
  });
  redirect(`/${locale}/admin`);
}

export async function setupOwnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = formLocale(formData);
  const address = await ip();
  const rate = rateLimit(`admin:setup:${address}`, 5, 60 * 60_000);
  if (!rate.allowed) return { error: "rateLimited" };

  const parsed = ownerSetupSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email").toLowerCase(),
    password: raw(formData, "password"),
    storeName: field(formData, "storeName"),
    telegramId: field(formData, "telegramId"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path[0];
    if (first === "password") return { error: "weak" };
    return { error: "validation" };
  }
  const confirm = raw(formData, "confirmPassword");
  if (parsed.data.password !== confirm) return { error: "mismatch" };

  const telegramRaw = parsed.data.telegramId?.trim() ?? "";
  if (telegramRaw && !/^\d{5,20}$/.test(telegramRaw)) {
    return { error: "validation" };
  }
  if (telegramRaw) {
    const taken = await prisma.adminUser.findUnique({
      where: { telegramId: telegramRaw },
      select: { id: true },
    });
    if (taken) return { error: "telegramTaken" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let adminId: string | null = null;
  try {
    adminId = await prisma.$transaction(async (tx) => {
      const owners = await tx.adminUser.count({ where: { role: "OWNER" } });
      if (owners > 0) return null;
      const created = await tx.adminUser.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: "OWNER",
          status: "ACTIVE",
          telegramId: telegramRaw || null,
        },
      });
      return created.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "emailTaken" };
    }
    console.error("[admin] owner setup failed", error);
    return { error: "validation" };
  }
  if (!adminId) return { error: "alreadyDone" };

  await setSetting(SETTING_KEYS.storeName, parsed.data.storeName);
  await recordAudit({
    adminId,
    action: "owner.created",
    entityType: "AdminUser",
    entityId: adminId,
    ip: address,
  });

  const session = await createAdminSession(adminId, { ip: address });
  await setSessionCookie(session.token);
  redirect(`/${locale}/admin`);
}

export async function logoutAction(formData: FormData) {
  const locale = formLocale(formData);
  const ctx = await getAdminSession();
  if (ctx) {
    await auditAdmin(ctx, "admin.logout", "AdminUser", ctx.id, undefined, await ip());
  }
  await revokeCurrentSession();
  await clearSessionCookie();
  redirect(`/${locale}/admin/login`);
}

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = formLocale(formData);
  const token = field(formData, "token");
  const password = raw(formData, "password");
  const confirm = raw(formData, "confirmPassword");
  if (!token) return { error: "inviteInvalid" };
  if (password !== confirm) return { error: "mismatch" };
  const passwordCheck = passwordSchema.safeParse(password);
  if (!passwordCheck.success) return { error: "weak" };

  const address = await ip();
  const invitation = await prisma.adminInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    return { error: "inviteInvalid" };
  }
  const existing = await prisma.adminUser.findUnique({ where: { email: invitation.email } });
  if (existing) return { error: "emailTaken" };

  const permissions = parseJsonArray(invitation.permissions).filter(isPermission);
  const passwordHash = await hashPassword(password);

  let adminId: string | null = null;
  try {
    adminId = await prisma.$transaction(async (tx) => {
      const fresh = await tx.adminInvitation.findUnique({ where: { id: invitation.id } });
      if (!fresh || fresh.acceptedAt || fresh.revokedAt || fresh.expiresAt.getTime() < Date.now()) {
        return null;
      }
      const created = await tx.adminUser.create({
        data: {
          name: invitation.name,
          email: invitation.email,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          permissions: {
            create: permissions.map((permission) => ({ permission })),
          },
        },
      });
      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      await tx.adminInvitation.updateMany({
        where: { email: invitation.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return created.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "emailTaken" };
    }
    console.error("[admin] invite acceptance failed", error);
    return { error: "inviteInvalid" };
  }
  if (!adminId) return { error: "inviteInvalid" };

  await recordAudit({
    adminId,
    action: "admin.invite.accepted",
    entityType: "AdminUser",
    entityId: adminId,
    details: { permissions },
    ip: address,
  });
  const session = await createAdminSession(adminId, { ip: address });
  await setSessionCookie(session.token);
  redirect(`/${locale}/admin`);
}

// ---------------------------------------------------------------------------
// Administrators
// ---------------------------------------------------------------------------

export async function inviteAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await ownerGuard(formData);
  const name = field(formData, "name");
  const emailRaw = field(formData, "email").toLowerCase();
  if (name.length < 2 || name.length > 120) return { error: "validation" };
  const parsed = emailSchema.safeParse(emailRaw);
  if (!parsed.success) return { error: "validation" };

  const permissions = [...new Set(formData.getAll("permissions").map(String).filter(isPermission))];
  if (!permissions.length) return { error: "permissionRequired" };
  // The owner has every permission; a non-owner (future custom role) may not
  // grant more than it holds.
  if (!isOwner(ctx) && permissions.some((permission) => !ctx.permissions.includes(permission))) {
    return { error: "cannotGrant" };
  }

  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: parsed.data } });
  if (existingAdmin) return { error: "emailTaken" };
  const pending = await prisma.adminInvitation.findFirst({
    where: {
      email: parsed.data,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) return { error: "invitePending" };

  const token = newToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.adminInvitation.create({
    data: {
      email: parsed.data,
      name,
      role: "ADMIN",
      permissions: JSON.stringify(permissions),
      tokenHash: hashToken(token),
      invitedById: ctx.id,
      expiresAt,
    },
  });
  await auditAdmin(ctx, "admin.invite.created", "AdminInvitation", null, { permissions }, await ip());
  return { ok: true, token, expiresAt: expiresAt.toISOString() };
}

export async function revokeInvitationAction(formData: FormData) {
  const ctx = await ownerGuard(formData);
  const id = field(formData, "id");
  if (!id) fail(formData, "/administrators", "validation");
  await prisma.adminInvitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await auditAdmin(ctx, "admin.invite.revoked", "AdminInvitation", id, undefined, await ip());
  done(formData, "/administrators", { ok: "updated" });
}

export async function updatePermissionsAction(formData: FormData) {
  const ctx = await ownerGuard(formData);
  const adminId = field(formData, "id");
  const target = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!target) fail(formData, "/administrators", "notFound");
  if (target.role === "OWNER") fail(formData, "/administrators", "ownerProtected");

  const permissions = [...new Set(formData.getAll("permissions").map(String).filter(isPermission))];
  if (!permissions.length) fail(formData, "/administrators", "permissionRequired");

  const telegramRaw = field(formData, "telegramId");
  const telegramId = telegramRaw ? telegramRaw.replace(/[^\d]/g, "").slice(0, 32) : null;
  if (telegramRaw && !/^\d{5,20}$/.test(telegramId ?? "")) {
    fail(formData, "/administrators", "validation");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminPermission.deleteMany({ where: { adminId } });
      await tx.adminPermission.createMany({
        data: permissions.map((permission) => ({ adminId, permission })),
      });
      await tx.adminUser.update({
        where: { id: adminId },
        data: { telegramId },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      fail(formData, "/administrators", "telegramTaken");
    }
    fail(formData, "/administrators", "validation");
  }

  await auditAdmin(ctx, "admin.permissions.updated", "AdminUser", adminId, { permissions }, await ip());
  done(formData, "/administrators", { ok: "permissionsSaved" });
}

export async function updateOwnTelegramIdAction(formData: FormData) {
  const locale = formLocale(formData);
  const ctx = await getAdminSession();
  if (!ctx) redirect(`/${locale}/admin/login`);
  if (!isOwner(ctx)) fail(formData, "/administrators", "forbidden");

  const raw = field(formData, "telegramId").trim();
  const telegramId = raw || null;
  if (telegramId && !/^\d{5,20}$/.test(telegramId)) {
    fail(formData, "/administrators", "validation");
  }

  try {
    await prisma.adminUser.update({
      where: { id: ctx.id },
      data: { telegramId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      fail(formData, "/administrators", "telegramTaken");
    }
    fail(formData, "/administrators", "validation");
  }

  await auditAdmin(
    ctx,
    "admin.telegram.updated",
    "AdminUser",
    ctx.id,
    { linked: Boolean(telegramId) },
    await ip(),
  );
  done(formData, "/administrators", { ok: "updated" });
}

export async function setAdminStatusAction(formData: FormData) {
  const ctx = await ownerGuard(formData);
  const adminId = field(formData, "id");
  const status = field(formData, "status");
  if (!["ACTIVE", "SUSPENDED", "REMOVED"].includes(status)) fail(formData, "/administrators", "validation");
  if (adminId === ctx.id) fail(formData, "/administrators", "cannotSelf");
  const target = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!target) fail(formData, "/administrators", "notFound");
  if (target.role === "OWNER") fail(formData, "/administrators", "ownerProtected");

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { status } });
    if (status !== "ACTIVE") {
      await tx.adminSession.deleteMany({ where: { adminId } });
    }
  });
  await auditAdmin(ctx, `admin.status.${status.toLowerCase()}`, "AdminUser", adminId, undefined, await ip());
  done(formData, "/administrators", { ok: "updated" });
}

// ---------------------------------------------------------------------------
// Catalog: products
// ---------------------------------------------------------------------------

export async function saveProductAction(formData: FormData) {
  const ctx = await guard(formData, "products.manage");
  const id = field(formData, "id");
  const slug = slugify(field(formData, "slug"));
  const categoryId = field(formData, "categoryId");
  const sku = field(formData, "sku") || null;
  const priceMinor = priceToMinor(field(formData, "price"));
  const originalRaw = field(formData, "originalPrice");
  const originalPriceMinor = originalRaw ? priceToMinor(originalRaw) : null;
  const dataAllowance = field(formData, "dataAllowance") || null;
  const validityDays = intOrNull(formData, "validityDays");
  const network = field(formData, "network") || null;
  const activationNotes = field(formData, "activationNotes") || null;
  const sortOrder = intOrNull(formData, "sortOrder") ?? 0;
  const countries = lines(field(formData, "countries"));
  const gallery = lines(field(formData, "gallery"), 8).map(safeImageUrl).filter((url): url is string => Boolean(url));
  const names = {
    ar: field(formData, "name_ar"),
    en: field(formData, "name_en"),
    tr: field(formData, "name_tr"),
  };
  const returnPath = id ? `/products/${id}` : "/products/new";

  if (!validSlug(slug)) fail(formData, returnPath, "validation");
  if (!categoryId) fail(formData, returnPath, "validation");
  if (!priceMinor) fail(formData, returnPath, "priceInvalid");
  if (originalPriceMinor && originalPriceMinor <= priceMinor) {
    fail(formData, returnPath, "originalPriceInvalid");
  }
  if (!names.ar) fail(formData, returnPath, "validation");
  if (validityDays !== null && (validityDays < 1 || validityDays > 3650)) {
    fail(formData, returnPath, "validation");
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) fail(formData, returnPath, "validation");

  let imageUrl: string | null = null;
  try {
    imageUrl = await imageFromForm(formData);
  } catch (error) {
    if (error instanceof UploadError) fail(formData, returnPath, "uploadError");
    fail(formData, returnPath, "validation");
  }

  const translations = [
    {
      locale: "ar",
      name: names.ar,
      shortDescription: field(formData, "short_ar") || null,
      description: field(formData, "desc_ar") || null,
    },
    {
      locale: "en",
      name: field(formData, "name_en"),
      shortDescription: field(formData, "short_en") || null,
      description: field(formData, "desc_en") || null,
    },
    {
      locale: "tr",
      name: field(formData, "name_tr"),
      shortDescription: field(formData, "short_tr") || null,
      description: field(formData, "desc_tr") || null,
    },
  ];

  const relatedIds = formData
    .getAll("relatedIds")
    .map(String)
    .filter((value) => value && value !== id)
    .slice(0, 12);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const base = {
        slug,
        sku,
        categoryId,
        imageUrl,
        galleryJson: JSON.stringify(gallery),
        priceMinor,
        originalPriceMinor,
        currency: "TRY",
        dataAllowance,
        validityDays,
        network,
        countriesJson: JSON.stringify(countries),
        activationNotes,
        isActive: bool(formData, "isActive"),
        isFeatured: bool(formData, "isFeatured"),
        sortOrder,
      };

      const row = id
        ? await tx.product.update({ where: { id }, data: base })
        : await tx.product.create({ data: base });

      for (const translation of translations) {
        if (translation.name) {
          await tx.productTranslation.upsert({
            where: { productId_locale: { productId: row.id, locale: translation.locale } },
            create: { productId: row.id, ...translation },
            update: {
              name: translation.name,
              shortDescription: translation.shortDescription,
              description: translation.description,
            },
          });
        } else {
          await tx.productTranslation.deleteMany({
            where: { productId: row.id, locale: translation.locale },
          });
        }
      }

      if (relatedIds.length) {
        const valid = await tx.product.findMany({
          where: { id: { in: relatedIds } },
          select: { id: true },
        });
        await tx.productRelation.deleteMany({ where: { productId: row.id } });
        await tx.productRelation.createMany({
          data: valid.map((entry, index) => ({
            productId: row.id,
            relatedId: entry.id,
            sortOrder: index,
          })),
        });
      } else {
        await tx.productRelation.deleteMany({ where: { productId: row.id } });
      }

      return row;
    });

    await auditAdmin(ctx, id ? "product.updated" : "product.created", "Product", product.id, {
      slug: product.slug,
      priceMinor: product.priceMinor,
    }, await ip());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      fail(formData, returnPath, "duplicateValue");
    }
    console.error("[admin] save product failed", error);
    fail(formData, returnPath, "validation");
  }

  revalidatePath("/", "layout");
  done(formData, "/products", { ok: id ? "updated" : "created" });
}

export async function toggleProductArchiveAction(formData: FormData) {
  const ctx = await guard(formData, "products.manage");
  const id = field(formData, "id");
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) fail(formData, "/products", "notFound");
  const archived = !product.isArchived;
  await prisma.product.update({
    where: { id },
    data: { isArchived: archived, isActive: archived ? false : product.isActive },
  });
  await auditAdmin(ctx, archived ? "product.archived" : "product.restored", "Product", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/products", { ok: "updated" });
}

export async function deleteProductAction(formData: FormData) {
  const ctx = await guard(formData, "products.manage");
  const id = field(formData, "id");
  const [orders, inventory] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.inventoryUnit.count({ where: { productId: id } }),
  ]);
  if (orders > 0 || inventory > 0) fail(formData, "/products", "deleteBlocked");
  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    fail(formData, "/products", "deleteBlocked");
  }
  await auditAdmin(ctx, "product.deleted", "Product", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/products", { ok: "deleted" });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function saveCouponAction(formData: FormData) {
  const ctx = await guard(formData, "coupons.manage");
  const id = field(formData, "id");
  const code = normalizeCouponCode(field(formData, "code"));
  const type = field(formData, "type");
  const returnPath = id ? `/coupons/${id}` : "/coupons/new";

  if (!isValidCouponCode(code)) fail(formData, returnPath, "couponCodeInvalid");
  if (!(COUPON_TYPES as readonly string[]).includes(type)) {
    fail(formData, returnPath, "validation");
  }

  let percentBasisPoints: number | null = null;
  let amountMinor: number | null = null;
  if (type === "PERCENT") {
    percentBasisPoints = percentToBasisPoints(field(formData, "value"));
    if (!percentBasisPoints || percentBasisPoints <= 0 || percentBasisPoints > 10000) {
      fail(formData, returnPath, "couponValueInvalid");
    }
  } else {
    amountMinor = amountToMinor(field(formData, "value"));
    if (!amountMinor) fail(formData, returnPath, "couponValueInvalid");
  }

  const minSubtotalMinor = amountToMinor(field(formData, "minSubtotal"), true);
  if (minSubtotalMinor === null) fail(formData, returnPath, "validation");

  const maxRaw = field(formData, "maxDiscount");
  const maxDiscountMinor = maxRaw ? amountToMinor(maxRaw) : null;
  if (maxRaw && !maxDiscountMinor) fail(formData, returnPath, "couponValueInvalid");

  const usageLimit = intOrNull(formData, "usageLimit");
  if (usageLimit !== null && (usageLimit < 1 || usageLimit > 1_000_000)) {
    fail(formData, returnPath, "validation");
  }
  const perCustomerLimit = intOrNull(formData, "perCustomerLimit");
  if (perCustomerLimit !== null && (perCustomerLimit < 1 || perCustomerLimit > 1000)) {
    fail(formData, returnPath, "validation");
  }

  const startsAt = couponDate(field(formData, "startsAt"));
  const expiresAt = couponDate(field(formData, "expiresAt"));
  if (
    (field(formData, "startsAt") && !startsAt) ||
    (field(formData, "expiresAt") && !expiresAt)
  ) {
    fail(formData, returnPath, "validation");
  }
  if (startsAt && expiresAt && expiresAt.getTime() <= startsAt.getTime()) {
    fail(formData, returnPath, "couponDateInvalid");
  }

  const existing = id ? await prisma.coupon.findUnique({ where: { id } }) : null;
  if (id && !existing) fail(formData, "/coupons", "notFound");
  if (existing && usageLimit !== null && usageLimit < existing.usedCount) {
    fail(formData, returnPath, "usageLimitTooLow");
  }

  const data = {
    code,
    type,
    percentBasisPoints,
    amountMinor,
    minSubtotalMinor,
    maxDiscountMinor: type === "PERCENT" ? maxDiscountMinor : null,
    usageLimit,
    perCustomerLimit,
    startsAt,
    expiresAt,
    isActive: bool(formData, "isActive"),
  };

  try {
    const coupon = id
      ? await prisma.coupon.update({ where: { id }, data })
      : await prisma.coupon.create({ data: { ...data, createdById: ctx.id } });
    await auditAdmin(
      ctx,
      id ? "coupon.updated" : "coupon.created",
      "Coupon",
      coupon.id,
      {
        code: coupon.code,
        type: coupon.type,
        usageLimit: coupon.usageLimit,
        perCustomerLimit: coupon.perCustomerLimit,
      },
      await ip(),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      fail(formData, returnPath, "couponCodeTaken");
    }
    console.error("[admin] save coupon failed", error);
    fail(formData, returnPath, "validation");
  }

  revalidatePath("/", "layout");
  done(formData, "/coupons", { ok: id ? "updated" : "created" });
}

export async function toggleCouponAction(formData: FormData) {
  const ctx = await guard(formData, "coupons.manage");
  const id = field(formData, "id");
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) fail(formData, "/coupons", "notFound");
  await prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
  });
  await auditAdmin(
    ctx,
    coupon.isActive ? "coupon.disabled" : "coupon.enabled",
    "Coupon",
    id,
    { code: coupon.code },
    await ip(),
  );
  revalidatePath("/", "layout");
  done(formData, "/coupons", { ok: "updated" });
}

export async function deleteCouponAction(formData: FormData) {
  const ctx = await guard(formData, "coupons.manage");
  const id = field(formData, "id");
  const orders = await prisma.order.count({ where: { couponId: id } });
  if (orders > 0) fail(formData, "/coupons", "couponDeleteBlocked");
  try {
    await prisma.coupon.delete({ where: { id } });
  } catch {
    fail(formData, "/coupons", "couponDeleteBlocked");
  }
  await auditAdmin(ctx, "coupon.deleted", "Coupon", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/coupons", { ok: "deleted" });
}

// ---------------------------------------------------------------------------
// Catalog: categories and banners
// ---------------------------------------------------------------------------

export async function saveCategoryAction(formData: FormData) {
  const ctx = await guard(formData, "categories.manage");
  const id = field(formData, "id");
  const slug = slugify(field(formData, "slug"));
  const nameAr = field(formData, "name_ar");
  const returnPath = "/categories";
  if (!validSlug(slug) || !nameAr) fail(formData, returnPath, "validation");

  let imageUrl: string | null = null;
  try {
    imageUrl = await imageFromForm(formData);
  } catch (error) {
    if (error instanceof UploadError) fail(formData, returnPath, "uploadError");
    fail(formData, returnPath, "validation");
  }

  const translations = [
    { locale: "ar", name: nameAr, description: field(formData, "description_ar") || null },
    { locale: "en", name: field(formData, "name_en"), description: field(formData, "description_en") || null },
    { locale: "tr", name: field(formData, "name_tr"), description: field(formData, "description_tr") || null },
  ];

  try {
    const row = await prisma.$transaction(async (tx) => {
      const base = {
        slug,
        imageUrl,
        sortOrder: intOrNull(formData, "sortOrder") ?? 0,
        isVisible: bool(formData, "isVisible"),
      };
      const category = id
        ? await tx.category.update({ where: { id }, data: base })
        : await tx.category.create({ data: base });
      for (const translation of translations) {
        if (translation.name) {
          await tx.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: category.id, locale: translation.locale } },
            create: { categoryId: category.id, ...translation },
            update: { name: translation.name, description: translation.description },
          });
        } else {
          await tx.categoryTranslation.deleteMany({
            where: { categoryId: category.id, locale: translation.locale },
          });
        }
      }
      return category;
    });
    await auditAdmin(ctx, id ? "category.updated" : "category.created", "Category", row.id, { slug }, await ip());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      fail(formData, returnPath, "duplicateValue");
    }
    fail(formData, returnPath, "validation");
  }
  revalidatePath("/", "layout");
  done(formData, returnPath, { ok: id ? "updated" : "created" });
}

export async function deleteCategoryAction(formData: FormData) {
  const ctx = await guard(formData, "categories.manage");
  const id = field(formData, "id");
  const products = await prisma.product.count({ where: { categoryId: id } });
  if (products > 0) fail(formData, "/categories", "deleteBlocked");
  try {
    await prisma.category.delete({ where: { id } });
  } catch {
    fail(formData, "/categories", "deleteBlocked");
  }
  await auditAdmin(ctx, "category.deleted", "Category", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/categories", { ok: "deleted" });
}

export async function saveBannerAction(formData: FormData) {
  const ctx = await guard(formData, "banners.manage");
  const id = field(formData, "id");
  const titleAr = field(formData, "title_ar");
  const linkType = field(formData, "linkType") || "NONE";
  const linkValueRaw = field(formData, "linkValue");
  const returnPath = "/banners";
  if (!titleAr) fail(formData, returnPath, "validation");
  if (!["NONE", "PRODUCT", "CATEGORY", "URL"].includes(linkType)) fail(formData, returnPath, "validation");

  let linkValue: string | null = null;
  if (linkType !== "NONE") {
    if (!linkValueRaw) fail(formData, returnPath, "validation");
    if (linkType === "URL") {
      try {
        const url = new URL(linkValueRaw);
        if (url.protocol !== "http:" && url.protocol !== "https:") fail(formData, returnPath, "validation");
        linkValue = url.toString().slice(0, 500);
      } catch {
        fail(formData, returnPath, "validation");
      }
    } else {
      linkValue = linkValueRaw.slice(0, 120);
    }
  }

  const startsAt = dateOrNull(field(formData, "startsAt"));
  const endsAt = dateOrNull(field(formData, "endsAt"));
  if (startsAt && endsAt && startsAt >= endsAt) fail(formData, returnPath, "validation");

  let imageUrl: string | null = null;
  try {
    imageUrl = await imageFromForm(formData);
  } catch (error) {
    if (error instanceof UploadError) fail(formData, returnPath, "uploadError");
    fail(formData, returnPath, "validation");
  }

  const translations = [
    {
      locale: "ar",
      title: titleAr,
      subtitle: field(formData, "subtitle_ar") || null,
      ctaLabel: field(formData, "cta_ar") || null,
    },
    {
      locale: "en",
      title: field(formData, "title_en"),
      subtitle: field(formData, "subtitle_en") || null,
      ctaLabel: field(formData, "cta_en") || null,
    },
    {
      locale: "tr",
      title: field(formData, "title_tr"),
      subtitle: field(formData, "subtitle_tr") || null,
      ctaLabel: field(formData, "cta_tr") || null,
    },
  ];

  try {
    const row = await prisma.$transaction(async (tx) => {
      const base = {
        imageUrl,
        linkType,
        linkValue,
        sortOrder: intOrNull(formData, "sortOrder") ?? 0,
        isVisible: bool(formData, "isVisible"),
        startsAt,
        endsAt,
      };
      const banner = id
        ? await tx.banner.update({ where: { id }, data: base })
        : await tx.banner.create({ data: base });
      for (const translation of translations) {
        if (translation.title) {
          await tx.bannerTranslation.upsert({
            where: { bannerId_locale: { bannerId: banner.id, locale: translation.locale } },
            create: { bannerId: banner.id, ...translation },
            update: {
              title: translation.title,
              subtitle: translation.subtitle,
              ctaLabel: translation.ctaLabel,
            },
          });
        } else {
          await tx.bannerTranslation.deleteMany({
            where: { bannerId: banner.id, locale: translation.locale },
          });
        }
      }
      return banner;
    });
    await auditAdmin(ctx, id ? "banner.updated" : "banner.created", "Banner", row.id, undefined, await ip());
  } catch {
    fail(formData, returnPath, "validation");
  }
  revalidatePath("/", "layout");
  done(formData, returnPath, { ok: id ? "updated" : "created" });
}

export async function deleteBannerAction(formData: FormData) {
  const ctx = await guard(formData, "banners.manage");
  const id = field(formData, "id");
  await prisma.banner.delete({ where: { id } }).catch(() => fail(formData, "/banners", "notFound"));
  await auditAdmin(ctx, "banner.deleted", "Banner", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/banners", { ok: "deleted" });
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function createInventoryAction(formData: FormData) {
  const ctx = await guard(formData, "inventory.manage");
  const productId = field(formData, "productId");
  const count = intOrNull(formData, "count") ?? 1;
  const activationCode = field(formData, "activationCode") || null;
  const instructions = field(formData, "instructions") || null;
  const notes = field(formData, "notes") || null;
  const file = formData.get("qrFile");
  const returnPath = `/inventory?product=${encodeURIComponent(productId)}`;

  if (!productId) fail(formData, "/inventory", "noProduct");
  if (count < 1 || count > 50) fail(formData, returnPath, "validation");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) fail(formData, "/inventory", "noProduct");

  const hasFile = file instanceof File && file.size > 0;
  if (count > 1 && (hasFile || activationCode)) {
    fail(formData, returnPath, hasFile ? "qrOnlySingle" : "singleOnly");
  }

  let qrPath: string | null = null;
  let qrMime: string | null = null;
  if (hasFile && count === 1) {
    try {
      const stored = await savePrivateFile(file, "delivery");
      qrPath = stored.relativePath;
      qrMime = stored.mimeType;
    } catch (error) {
      if (error instanceof UploadError) fail(formData, returnPath, "uploadError");
      fail(formData, returnPath, "uploadError");
    }
  }

  if (count === 1) {
    await prisma.inventoryUnit.create({
      data: {
        productId,
        status: "AVAILABLE",
        activationCode,
        qrPath,
        instructions,
        notes,
      },
    });
  } else {
    await prisma.inventoryUnit.createMany({
      data: Array.from({ length: count }, () => ({
        productId,
        status: "AVAILABLE",
        instructions,
        notes,
      })),
    });
  }

  await auditAdmin(ctx, "inventory.created", "Product", productId, {
    count,
    hasActivationCode: Boolean(activationCode),
    hasQr: Boolean(qrPath),
    qrMime,
  }, await ip());
  revalidatePath("/", "layout");
  done(formData, returnPath, { ok: "inventoryCreated", count });
}

export async function revokeInventoryAction(formData: FormData) {
  const ctx = await guard(formData, "inventory.manage");
  const id = field(formData, "id");
  const unit = await prisma.inventoryUnit.findUnique({ where: { id }, include: { order: { select: { status: true } } } });
  if (!unit) fail(formData, "/inventory", "notFound");
  if (unit.deliveredAt || unit.status === "ASSIGNED" || unit.order?.status === "DELIVERED") {
    fail(formData, "/inventory", "cannotDeleteAssigned");
  }
  if (unit.orderId) fail(formData, "/inventory", "cannotDeleteAssigned");
  await prisma.inventoryUnit.update({
    where: { id },
    data: { status: "REVOKED", orderId: null, orderItemId: null, reservedUntil: null },
  });
  await auditAdmin(ctx, "inventory.revoked", "InventoryUnit", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/inventory", { ok: "revokedMsg" });
}

export async function releaseInventoryAction(formData: FormData) {
  const ctx = await guard(formData, "inventory.manage");
  const id = field(formData, "id");
  const unit = await prisma.inventoryUnit.findUnique({ where: { id } });
  if (!unit || unit.status !== "RESERVED") fail(formData, "/inventory", "notFound");
  await prisma.inventoryUnit.update({
    where: { id },
    data: {
      status: "AVAILABLE",
      orderId: null,
      orderItemId: null,
      reservedUntil: null,
      assignedAt: null,
      assignedById: null,
    },
  });
  await auditAdmin(ctx, "inventory.released", "InventoryUnit", id, undefined, await ip());
  revalidatePath("/", "layout");
  done(formData, "/inventory", { ok: "released" });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function orderActor(ctx: AdminContext, address: string) {
  return { type: "ADMIN" as const, adminId: ctx.id, ip: address };
}

async function orderAction(
  formData: FormData,
  permission: Permission,
  runner: (ctx: AdminContext, id: string) => Promise<{ ok: string; extra?: Record<string, string | number> }>,
) {
  const ctx = await guard(formData, permission);
  const id = field(formData, "id");
  if (!id) fail(formData, "/orders", "notFound");
  const returnPath = `/orders/${id}`;
  let result: { ok: string; extra?: Record<string, string | number> };
  try {
    result = await runner(ctx, id);
  } catch (error) {
    if (error instanceof OrderError) fail(formData, returnPath, error.code);
    console.error("[admin] order action failed", error);
    fail(formData, returnPath, "generic");
  }
  done(formData, returnPath, { ok: result.ok, ...(result.extra ?? {}) });
}

export async function confirmOrderAction(formData: FormData) {
  const ctx = await guard(formData, "orders.confirm");
  const id = field(formData, "id");
  if (!id) fail(formData, "/orders", "notFound");
  const returnPath = `/orders/${id}`;
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });

  // Verifying a bank-transfer receipt is a payment-review action, not merely
  // an order-status action. Both permissions are required.
  if (order?.status === "PAYMENT_REVIEW" && !hasPermissionSafe(ctx, "payments.review")) {
    fail(formData, returnPath, "forbidden");
  }

  let outcome = "statusUpdated";
  try {
    if (order?.status === "PAYMENT_REVIEW") {
      await confirmPayment(id, orderActor(ctx, await ip()));
      outcome = "paymentVerified";
    } else {
      await transitionOrder(id, "CONFIRMED", orderActor(ctx, await ip()), "admin-confirmed");
    }
  } catch (error) {
    if (error instanceof OrderError) fail(formData, returnPath, error.code);
    console.error("[admin] order action failed", error);
    fail(formData, returnPath, "generic");
  }
  done(formData, returnPath, { ok: outcome });
}

export async function cancelOrderAction(formData: FormData) {
  await orderAction(formData, "orders.confirm", async (ctx, id) => {
    await cancelOrder(id, orderActor(ctx, await ip()), field(formData, "note") || undefined);
    return { ok: "statusUpdated" };
  });
}

export async function startProcessingAction(formData: FormData) {
  await orderAction(formData, "orders.update", async (ctx, id) => {
    await startProcessing(id, orderActor(ctx, await ip()));
    return { ok: "statusUpdated" };
  });
}

export async function deliverOrderAction(formData: FormData) {
  await orderAction(formData, "inventory.deliver", async (ctx, id) => {
    await deliverOrder(id, orderActor(ctx, await ip()));
    return { ok: "deliverySuccess" };
  });
}

export async function refundOrderAction(formData: FormData) {
  await orderAction(formData, "payments.review", async (ctx, id) => {
    await transitionOrder(id, "REFUNDED", orderActor(ctx, await ip()), "admin-refunded");
    return { ok: "statusUpdated" };
  });
}

export async function assignInventoryAction(formData: FormData) {
  await orderAction(formData, "inventory.deliver", async (ctx, id) => {
    const unitId = field(formData, "unitId") || undefined;
    const result = await assignInventory(id, orderActor(ctx, await ip()), { unitId });
    return { ok: "assigned", extra: { count: result.assigned } };
  });
}

export async function verifyPaymentAction(formData: FormData) {
  await orderAction(formData, "payments.review", async (ctx, id) => {
    await confirmPayment(id, orderActor(ctx, await ip()), field(formData, "note") || undefined);
    return { ok: "paymentVerified" };
  });
}

export async function rejectPaymentAction(formData: FormData) {
  await orderAction(formData, "payments.review", async (ctx, id) => {
    await rejectPayment(id, orderActor(ctx, await ip()), field(formData, "note") || undefined);
    return { ok: "paymentRejected" };
  });
}

export async function updateOrderNoteAction(formData: FormData) {
  const ctx = await guard(formData, "orders.update");
  const id = field(formData, "id");
  const note = field(formData, "adminNote").slice(0, 1000);
  await prisma.order.update({ where: { id }, data: { adminNote: note || null } });
  await auditAdmin(ctx, "order.note.updated", "Order", id, undefined, await ip());
  done(formData, `/orders/${id}`, { ok: "updated" });
}

// ---------------------------------------------------------------------------
// Settings and maintenance
// ---------------------------------------------------------------------------

export async function saveSettingsAction(formData: FormData) {
  const ctx = await guardAny(formData, [
    "settings.manage",
    "content.manage",
    "translations.manage",
  ]);
  const canSettings = hasPermissionSafe(ctx, "settings.manage");
  const canContent =
    hasPermissionSafe(ctx, "content.manage") ||
    hasPermissionSafe(ctx, "translations.manage");
  const storeName = field(formData, "storeName");
  const logoUrl = safeImageUrl(field(formData, "logoUrl")) ?? "/brand/logo.svg";
  const primaryColor = field(formData, "primaryColor");
  const supportEmail = field(formData, "supportEmail");
  if (canSettings) {
    if (storeName.length < 2 || storeName.length > 120) fail(formData, "/settings", "validation");
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) fail(formData, "/settings", "validation");
    if (supportEmail) {
      const parsed = emailSchema.safeParse(supportEmail);
      if (!parsed.success) fail(formData, "/settings", "validation");
    }
    const iban = field(formData, "bankIban");
    if (iban.length > 40) fail(formData, "/settings", "validation");
  }

  const values: [string, unknown][] = [];

  if (canContent || canSettings) {
    values.push(
      [SETTING_KEYS.tagline, localizedField(formData, "tagline")],
      [SETTING_KEYS.announcement, localizedField(formData, "announcement")],
      [SETTING_KEYS.heroTitle, localizedField(formData, "heroTitle")],
      [SETTING_KEYS.heroSubtitle, localizedField(formData, "heroSubtitle")],
      [SETTING_KEYS.supportHours, localizedField(formData, "supportHours")],
      [SETTING_KEYS.bankInstructions, localizedField(formData, "bankInstructions")],
      [SETTING_KEYS.privacyPolicy, localizedField(formData, "privacyPolicy")],
      [SETTING_KEYS.terms, localizedField(formData, "terms")],
      [SETTING_KEYS.refundPolicy, localizedField(formData, "refundPolicy")],
      [SETTING_KEYS.retentionPolicy, localizedField(formData, "retentionPolicy")],
    );
  }

  if (canSettings) {
    values.push(
      [SETTING_KEYS.storeName, storeName],
      [SETTING_KEYS.logoUrl, logoUrl],
      [SETTING_KEYS.primaryColor, primaryColor],
      [SETTING_KEYS.currency, "TRY"],
      [SETTING_KEYS.whatsapp, field(formData, "whatsapp").slice(0, 60)],
      [SETTING_KEYS.supportEmail, supportEmail],
      [SETTING_KEYS.bankAccountName, field(formData, "bankAccountName").slice(0, 160)],
      [SETTING_KEYS.bankIban, field(formData, "bankIban")],
      [SETTING_KEYS.bankName, field(formData, "bankName").slice(0, 160)],
      [SETTING_KEYS.bankTransferEnabled, bool(formData, "bankTransferEnabled")],
      [SETTING_KEYS.codEnabled, bool(formData, "codEnabled")],
      [SETTING_KEYS.ordersEnabled, bool(formData, "ordersEnabled")],
      [SETTING_KEYS.maintenanceMode, bool(formData, "maintenanceMode")],
      [SETTING_KEYS.showOffers, bool(formData, "showOffers")],
      [SETTING_KEYS.showFeatures, bool(formData, "showFeatures")],
      [SETTING_KEYS.showCategories, bool(formData, "showCategories")],
      [SETTING_KEYS.showFeatured, bool(formData, "showFeatured")],
    );
  }

  await prisma.$transaction(
    values.map(([key, value]) =>
      prisma.storeSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: { value: JSON.stringify(value) },
      }),
    ),
  );

  await auditAdmin(ctx, "settings.updated", "StoreSetting", null, {
    keys: values.map(([key]) => key),
  }, await ip());
  revalidatePath("/", "layout");
  done(formData, "/settings", { ok: "saved" });
}

export async function retryNotificationsAction(formData: FormData) {
  const ctx = await guard(formData, "telegram.manage");
  const result = await retryPendingNotifications();
  await auditAdmin(ctx, "telegram.retry", "TelegramNotification", null, result, await ip());
  done(formData, "/settings", { ok: "retry", sent: result.sent, failed: result.failed });
}
