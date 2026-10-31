import "server-only";
import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/auth";
import { OrderError } from "@/lib/orders";
import { UploadError } from "@/lib/storage";

export function apiError(status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export function apiOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers: { "cache-control": "no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return apiError(error.status, error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
  }
  if (error instanceof OrderError) {
    return apiError(error.status, error.code, error.meta);
  }
  if (error instanceof UploadError) {
    return apiError(400, "UPLOAD_ERROR", { reason: error.message });
  }
  console.error("[api] unhandled error", error);
  return apiError(500, "INTERNAL_ERROR");
}

export function requestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return (headers.get("x-real-ip") || "local").slice(0, 64);
}

export function fileResponse(buffer: Buffer, mimeType: string, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": mimeType,
      "content-disposition": `inline; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
