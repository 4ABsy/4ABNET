import { type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hasAnyPermission } from "@/lib/auth";
import { readPrivateFile } from "@/lib/storage";
import { apiError, fileResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminSession();
  if (!ctx) return apiError(401, "UNAUTHORIZED");
  if (!hasAnyPermission(ctx, ["inventory.manage", "inventory.deliver"])) {
    return apiError(403, "FORBIDDEN");
  }

  const { id } = await params;
  const unit = await prisma.inventoryUnit.findUnique({
    where: { id },
    select: { qrPath: true },
  });
  if (!unit?.qrPath) return apiError(404, "NOT_FOUND");

  try {
    const buffer = await readPrivateFile(unit.qrPath);
    const ext = path.extname(unit.qrPath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
    return fileResponse(buffer, mime, `esim-asset${ext}`);
  } catch {
    return apiError(404, "NOT_FOUND");
  }
}
