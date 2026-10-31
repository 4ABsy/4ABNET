import { type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { hasOrderAccess } from "@/lib/order-access";
import { readPrivateFile } from "@/lib/storage";
import { apiError, fileResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const referenceValue = reference.trim().toUpperCase();
  if (!(await hasOrderAccess(referenceValue))) return apiError(404, "NOT_FOUND");

  const order = await prisma.order.findUnique({
    where: { reference: referenceValue },
    select: { id: true, status: true },
  });
  if (!order || order.status !== "DELIVERED") return apiError(404, "NOT_FOUND");

  const unitId = new URL(_request.url).searchParams.get("unit");
  const unit = await prisma.inventoryUnit.findFirst({
    where: {
      orderId: order.id,
      status: "ASSIGNED",
      deliveredAt: { not: null },
      qrPath: { not: null },
      ...(unitId ? { id: unitId } : {}),
    },
    select: { qrPath: true },
  });
  if (!unit?.qrPath) return apiError(404, "NOT_FOUND");

  try {
    const buffer = await readPrivateFile(unit.qrPath);
    const ext = path.extname(unit.qrPath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
    return fileResponse(buffer, mime, `4ab-esim-qr${ext}`);
  } catch {
    return apiError(404, "NOT_FOUND");
  }
}
