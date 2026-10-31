import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, type Permission } from "@/lib/constants";
import { env } from "@/lib/env";

const scrypt = promisify(scryptCb);
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
    const expected = Buffer.from(hash, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export type AdminContext = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: string[];
  sessionId: string;
};

export const getAdminSession = cache(async (): Promise<AdminContext | null> => {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { admin: { include: { permissions: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.admin.status !== "ACTIVE") return null;
  return {
    id: session.admin.id,
    name: session.admin.name,
    email: session.admin.email,
    role: session.admin.role,
    status: session.admin.status,
    permissions: session.admin.permissions.map((p) => p.permission),
    sessionId: session.id,
  };
});

export function isOwner(ctx: AdminContext | null): boolean {
  return ctx?.role === "OWNER" && ctx.status === "ACTIVE";
}

export function hasPermission(ctx: AdminContext | null, permission: Permission): boolean {
  if (!ctx) return false;
  if (isOwner(ctx)) return true;
  return ctx.permissions.includes(permission);
}

export function hasAnyPermission(ctx: AdminContext | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(ctx, p));
}

export class AuthorizationError extends Error {
  status: number;
  constructor(message = "Forbidden", status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminSession();
  if (!ctx) throw new AuthorizationError("Authentication required", 401);
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!hasPermission(ctx, permission)) {
    throw new AuthorizationError("Permission denied", 403);
  }
  return ctx;
}

export async function createAdminSession(
  adminId: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; sessionId: string }> {
  const token = newToken(32);
  const session = await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      adminId,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 500) ?? null,
    },
  });
  return { token, sessionId: session.id };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 8 * 60 * 60,
  };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function revokeCurrentSession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
}

/** Verify the browser origin for mutating requests (defense in depth; cookies are SameSite=Lax). */
export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // non-browser clients (bot callbacks use their own secret header)
  const host = h.get("host");
  try {
    const originHost = new URL(origin).host;
    if (!host || originHost !== host) {
      throw new AuthorizationError("Cross-origin request rejected", 403);
    }
  } catch {
    throw new AuthorizationError("Invalid origin", 403);
  }
}

export async function createTelegramLoginToken(adminId: string): Promise<string> {
  const token = newToken(32);
  await prisma.adminLoginToken.create({
    data: {
      tokenHash: hashToken(token),
      adminId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return token;
}

export async function consumeTelegramLoginToken(token: string) {
  const tokenHash = hashToken(token);
  const row = await prisma.adminLoginToken.findUnique({ where: { tokenHash } });
  if (!row) return null;
  if (row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  const updated = await prisma.adminLoginToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: row.adminId } });
  if (!admin || admin.status !== "ACTIVE") return null;
  return admin;
}

export function newId(): string {
  return randomUUID();
}
