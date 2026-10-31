import { type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hasPermission } from "@/lib/auth";
import { readPrivateFile } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { apiError, fileResponse, requestIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminSession();
  if (!ctx) return apiError(401, "UNAUTHORIZED");
  if (!hasPermission(ctx, "payments.receipts.view")) return apiError(403, "FORBIDDEN");

  const { id } = await params;
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id },
    include: { order: { select: { reference: true } } },
  });
  if (!receipt) return apiError(404, "NOT_FOUND");

  try {
    const buffer = await readPrivateFile(receipt.storagePath);
    await recordAudit({
      adminId: ctx.id,
      action: "payment.receipt.viewed",
      entityType: "PaymentReceipt",
      entityId: receipt.id,
      details: { orderReference: receipt.order.reference },
      ip: requestIp(request.headers),
    });
    return fileResponse(buffer, receipt.mimeType, receipt.originalName);
  } catch {
    return apiError(404, "NOT_FOUND");
  }
}
