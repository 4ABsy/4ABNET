import "server-only";
import { prisma } from "@/lib/prisma";
import type { AdminContext } from "@/lib/auth";

type AuditInput = {
  adminId?: string | null;
  actorType?: "ADMIN" | "SYSTEM" | "TELEGRAM";
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
  success?: boolean;
};

/**
 * Persist an administrative audit record. Never pass passwords, tokens,
 * activation codes or receipt contents in `details`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId ?? null,
        actorType: input.actorType ?? (input.adminId ? "ADMIN" : "SYSTEM"),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: JSON.stringify(input.details ?? {}),
        ip: input.ip ?? null,
        success: input.success ?? true,
      },
    });
  } catch (error) {
    // Auditing must never break the primary operation, but the failure is logged.
    console.error("[audit] failed to record", input.action, error);
  }
}

export async function auditAdmin(
  ctx: AdminContext,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
  ip?: string | null,
) {
  await recordAudit({
    adminId: ctx.id,
    actorType: "ADMIN",
    action,
    entityType,
    entityId,
    details,
    ip,
  });
}
