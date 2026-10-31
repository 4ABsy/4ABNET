import "server-only";
import { cookies } from "next/headers";
import { ORDER_COOKIE } from "@/lib/constants";
import { env } from "@/lib/env";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-token";

export { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-token";

export function orderCookieOptions(maxAge = 30 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setOrderAccessCookie(reference: string) {
  const store = await cookies();
  store.set(ORDER_COOKIE, createOrderAccessToken(reference), orderCookieOptions());
}

export async function getOrderAccessReference(): Promise<string | null> {
  const store = await cookies();
  return verifyOrderAccessToken(store.get(ORDER_COOKIE)?.value);
}

export async function hasOrderAccess(reference: string): Promise<boolean> {
  return (await getOrderAccessReference()) === reference;
}
