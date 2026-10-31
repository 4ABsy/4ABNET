import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasOrderAccess } from "@/lib/order-access";
import { savePrivateFile } from "@/lib/storage";
import { submitReceiptRecord } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { apiError, apiOk, errorResponse, requestIp } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const ip = requestIp(request.headers);
  const limit = rateLimit(`receipt:${ip}`, 6, 10 * 60_000);
  if (!limit.allowed) return apiError(429, "RATE_LIMITED");

  const referenceValue = reference.trim().toUpperCase();
  if (!(await hasOrderAccess(referenceValue))) return apiError(404, "NOT_FOUND");

  const order = await prisma.order.findUnique({
    where: { reference: referenceValue },
    select: { id: true, status: true, paymentMethod: true },
  });
  if (!order) return apiError(404, "NOT_FOUND");
  if (order.paymentMethod !== "BANK_TRANSFER") return apiError(409, "INVALID_METHOD");
  if (!["AWAITING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status)) {
    return apiError(409, "INVALID_STATE");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "INVALID_FORM_DATA");
  }
  const file = formData.get("receipt");
  if (!(file instanceof File)) return apiError(400, "FILE_REQUIRED");

  try {
    const stored = await savePrivateFile(file, "receipts");
    try {
      await submitReceiptRecord({
        orderId: order.id,
        storagePath: stored.relativePath,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
        sha256: stored.sha256,
      });
    } catch (error) {
      const { deletePrivateFile } = await import("@/lib/storage");
      await deletePrivateFile(stored.relativePath);
      throw error;
    }
    return apiOk({ uploaded: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
