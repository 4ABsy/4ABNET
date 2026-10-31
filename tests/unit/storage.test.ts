import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePrivateFile, savePublicImage, readPrivateFile, deletePrivateFile, storageBackend, UploadError } from "@/lib/storage";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x20)]);

function jpegFile(name = "photo.jpg") {
  return new File([new Uint8Array(JPEG)], name, { type: "image/jpeg" });
}

const savedEnv = { ...process.env };

function setSupabase(url = "https://demo.supabase.co", key = "service-key") {
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
}

beforeEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NETLIFY;
  delete process.env.VERCEL;
  process.env.MAX_UPLOAD_MB = "4";
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.unstubAllGlobals();
});

describe("storage backend selection", () => {
  it("uses local disk when Supabase is not configured", () => {
    expect(storageBackend()).toBe("local");
  });

  it("uses Supabase when both variables are set", () => {
    setSupabase();
    expect(storageBackend()).toBe("supabase");
  });

  it("refuses a half-configured Supabase setup", async () => {
    process.env.SUPABASE_URL = "https://demo.supabase.co";
    await expect(savePublicImage(jpegFile())).rejects.toThrow("storage-misconfigured");
  });

  it("refuses local writes on a serverless platform", async () => {
    process.env.NETLIFY = "true";
    const error = await savePublicImage(jpegFile()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect((error as UploadError).message).toBe("storage-not-configured");
  });
});

describe("Supabase Storage adapter", () => {
  it("uploads a catalog image and returns its public URL", async () => {
    setSupabase();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ Key: "catalog/x.jpg" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await savePublicImage(jpegFile());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/demo\.supabase\.co\/storage\/v1\/object\/media\/catalog\/[0-9a-f-]{36}\.jpg$/);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("apikey")).toBe("service-key");
    expect(headers.get("authorization")).toBe("Bearer service-key");
    expect(headers.get("content-type")).toBe("image/jpeg");
    expect(saved.url).toMatch(/\/storage\/v1\/object\/public\/media\/catalog\/[0-9a-f-]{36}\.jpg$/);
    expect(saved.bytes).toBe(JPEG.length);
  });

  it("stores private files in the private bucket with a portable relative path", async () => {
    setSupabase();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const stored = await savePrivateFile(jpegFile("receipt.jpg"), "receipts");

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/demo\.supabase\.co\/storage\/v1\/object\/private\/receipts\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.relativePath).toMatch(/^receipts\/[0-9a-f-]{36}\.jpg$/);
    expect(stored.mimeType).toBe("image/jpeg");
    expect(stored.originalName).toBe("receipt.jpg");
    expect(stored.sha256).toHaveLength(64);
  });

  it("reads a private object as a Buffer", async () => {
    setSupabase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(JPEG), { status: 200 })));

    const buffer = await readPrivateFile("delivery/abc.png");

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.equals(JPEG)).toBe(true);
  });

  it("surfaces a failed download instead of returning empty data", async () => {
    setSupabase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));

    await expect(readPrivateFile("delivery/abc.png")).rejects.toThrow("storage-read-failed:404");
  });

  it("deletes best-effort and tolerates an already-missing object", async () => {
    setSupabase();
    const fetchMock = vi.fn(async () => new Response("gone", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deletePrivateFile("receipts/gone.pdf")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://demo.supabase.co/storage/v1/object/private/receipts/gone.pdf");
    expect(init.method).toBe("DELETE");
  });

  it("rejects traversal in private paths", async () => {
    setSupabase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 400 })));

    await expect(readPrivateFile("../../etc/passwd")).rejects.toThrow("invalid-path");
  });
});
