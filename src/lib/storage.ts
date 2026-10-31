import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Storage strategy:
 * - Local development: public catalog assets live in ./public/uploads and are
 *   served by Next.js; private receipts and delivery files live in
 *   ./storage/private, outside the web root, and are streamed only through
 *   authorized route handlers.
 * - Hosted/serverless deployment: Supabase Storage. Public images go to a
 *   public bucket (absolute public URLs), private files go to a private bucket
 *   and are read server-side with the service-role key only.
 *
 * The stored `relativePath` for private files has the same shape
 * ("receipts/<uuid>.<ext>", "delivery/<uuid>.<ext>") on both backends, so
 * database rows stay valid when moving between local disk and Supabase.
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are server-only. Never expose the
 * service-role key to the browser and never prefix it with NEXT_PUBLIC_.
 */

const ROOT = process.cwd();
export const PUBLIC_UPLOAD_DIR = path.join(ROOT, "public", "uploads");
export const PRIVATE_DIR = path.join(ROOT, "storage", "private");

export type UploadKind = "image" | "receipt" | "delivery";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export type ValidatedUpload = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  sha256: string;
};

export async function validateUpload(file: File, kind: UploadKind): Promise<ValidatedUpload> {
  const max = kind === "image" ? Math.min(env.maxUploadBytes, 5 * 1024 * 1024) : env.maxUploadBytes;
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new UploadError("empty-file");
  }
  if (file.size > max) throw new UploadError("file-too-large");
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buffer);
  if (!sniffed) throw new UploadError("unsupported-file-type");

  const allowed = kind === "image" ? IMAGE_TYPES : RECEIPT_TYPES;
  if (!allowed[sniffed]) throw new UploadError("unsupported-file-type");
  // The declared type may be misleading; only the sniffed type is trusted.
  const extension = allowed[sniffed]!;
  return {
    buffer,
    mimeType: sniffed,
    extension,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

// ---------------------------------------------------------------------------
// Supabase Storage REST client (no SDK dependency)
// ---------------------------------------------------------------------------

const STORAGE_TIMEOUT_MS = 20_000;

type SupabaseStorage = {
  url: string;
  serviceKey: string;
  publicBucket: string;
  privateBucket: string;
};

/**
 * Returns the Supabase configuration, null when storage is not configured at
 * all, and throws when it is half-configured (so a typo cannot silently fall
 * back to an ephemeral local filesystem on a hosted platform).
 */
function supabaseStorage(): SupabaseStorage | null {
  const url = env.supabaseUrl;
  const serviceKey = env.supabaseServiceRoleKey;
  if (!url && !serviceKey) return null;
  if (!url || !serviceKey) {
    throw new UploadError("storage-misconfigured");
  }
  return {
    url,
    serviceKey,
    publicBucket: env.supabasePublicBucket,
    privateBucket: env.supabasePrivateBucket,
  };
}

export function storageBackend(): "supabase" | "local" {
  if (supabaseStorage()) return "supabase";
  return "local";
}

/** Human-readable status for the admin settings screen. Never returns keys. */
export function storageStatus() {
  const configured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
  const partial = Boolean(env.supabaseUrl) !== Boolean(env.supabaseServiceRoleKey);
  return {
    backend: configured ? ("supabase" as const) : ("local" as const),
    partial,
    serverless: env.isServerless,
    publicBucket: configured ? env.supabasePublicBucket : null,
    privateBucket: configured ? env.supabasePrivateBucket : null,
  };
}

function encodePath(objectPath: string): string {
  return objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function storageUrl(cfg: SupabaseStorage, pathname: string): string {
  return `${cfg.url}/storage/v1${pathname}`;
}

async function storageFetch(
  cfg: SupabaseStorage,
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", cfg.serviceKey);
  headers.set("authorization", `Bearer ${cfg.serviceKey}`);
  return fetch(storageUrl(cfg, pathname), {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  });
}

async function supabaseUpload(
  cfg: SupabaseStorage,
  bucket: string,
  objectPath: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const response = await storageFetch(
    cfg,
    `/object/${encodePath(bucket)}/${encodePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        "content-type": mimeType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-upsert": "false",
      },
      body: new Uint8Array(buffer),
    },
  );
  if (!response.ok) {
    throw new UploadError(`storage-upload-failed:${response.status}`);
  }
}

function supabasePublicUrl(cfg: SupabaseStorage, objectPath: string): string {
  return `${cfg.url}/storage/v1/object/public/${encodePath(cfg.publicBucket)}/${encodePath(objectPath)}`;
}

async function supabaseRead(
  cfg: SupabaseStorage,
  bucket: string,
  objectPath: string,
): Promise<Buffer> {
  const response = await storageFetch(
    cfg,
    `/object/${encodePath(bucket)}/${encodePath(objectPath)}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new UploadError(`storage-read-failed:${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function supabaseDelete(
  cfg: SupabaseStorage,
  bucket: string,
  objectPath: string,
): Promise<void> {
  const response = await storageFetch(
    cfg,
    `/object/${encodePath(bucket)}/${encodePath(objectPath)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new UploadError(`storage-delete-failed:${response.status}`);
  }
}

/** Local disk is ephemeral and read-only on serverless platforms. */
function assertLocalWritable(): void {
  if (env.isServerless) {
    throw new UploadError("storage-not-configured");
  }
}

// ---------------------------------------------------------------------------
// Public API used by the application
// ---------------------------------------------------------------------------

export async function savePublicImage(file: File): Promise<{ url: string; bytes: number }> {
  const validated = await validateUpload(file, "image");
  const cfg = supabaseStorage();
  const name = `${randomUUID()}.${validated.extension}`;

  if (cfg) {
    const objectPath = `catalog/${name}`;
    await supabaseUpload(cfg, cfg.publicBucket, objectPath, validated.buffer, validated.mimeType);
    return { url: supabasePublicUrl(cfg, objectPath), bytes: validated.buffer.length };
  }

  assertLocalWritable();
  await mkdir(PUBLIC_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(PUBLIC_UPLOAD_DIR, name), validated.buffer);
  return { url: `/uploads/${name}`, bytes: validated.buffer.length };
}

export async function savePrivateFile(
  file: File,
  area: "receipts" | "delivery",
): Promise<{
  relativePath: string;
  mimeType: string;
  size: number;
  sha256: string;
  originalName: string;
}> {
  const kind: UploadKind = area === "receipts" ? "receipt" : "delivery";
  const validated = await validateUpload(file, kind);
  const name = `${randomUUID()}.${validated.extension}`;
  const relativePath = `${area}/${name}`;
  const cfg = supabaseStorage();

  if (cfg) {
    await supabaseUpload(cfg, cfg.privateBucket, relativePath, validated.buffer, validated.mimeType);
  } else {
    assertLocalWritable();
    const dir = path.join(PRIVATE_DIR, area);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), validated.buffer);
  }

  return {
    relativePath,
    mimeType: validated.mimeType,
    size: validated.buffer.length,
    sha256: validated.sha256,
    originalName: sanitizeOriginalName(file.name),
  };
}

export function sanitizeOriginalName(name: string): string {
  return name.replace(/[^\w.\-() \u0600-\u06FF]/g, "_").slice(0, 180) || "file";
}

/** Resolve a relative private path, refusing traversal. */
export function resolvePrivatePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new UploadError("invalid-path");
  }
  const absolute = path.resolve(PRIVATE_DIR, normalized);
  const root = path.resolve(PRIVATE_DIR);
  if (!absolute.startsWith(root + path.sep)) throw new UploadError("invalid-path");
  return absolute;
}

function assertSafeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new UploadError("invalid-path");
  }
  return normalized;
}

export async function readPrivateFile(relativePath: string): Promise<Buffer> {
  const cfg = supabaseStorage();
  if (cfg) {
    return supabaseRead(cfg, cfg.privateBucket, assertSafeRelativePath(relativePath));
  }
  return readFile(resolvePrivatePath(relativePath));
}

export async function deletePrivateFile(relativePath: string): Promise<void> {
  const cfg = supabaseStorage();
  if (cfg) {
    try {
      await supabaseDelete(cfg, cfg.privateBucket, assertSafeRelativePath(relativePath));
    } catch {
      // best effort
    }
    return;
  }
  try {
    await unlink(resolvePrivatePath(relativePath));
  } catch {
    // best effort
  }
}

export async function fetchTelegramFileToPrivate(
  fileId: string,
  botToken: string,
  area: "delivery",
): Promise<{ relativePath: string; mimeType: string; size: number; sha256: string }> {
  // Not used by the default manual-upload workflow; kept out of request paths.
  throw new Error("Telegram file fetch is not enabled in manual inventory mode");
}
