import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", env.appSecret).update(payload).digest("base64url");
}

export function createOrderAccessToken(reference: string, ttlSeconds = THIRTY_DAYS): string {
  const payload = Buffer.from(
    JSON.stringify({ ref: reference, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOrderAccessToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      ref?: unknown;
      exp?: unknown;
    };
    if (typeof data.ref !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.ref;
  } catch {
    return null;
  }
}
