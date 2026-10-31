import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  SESSION_COOKIE,
  detectLocale,
  isLocale,
  normalizeLocale,
} from "@/lib/constants";

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|webmanifest|woff2|css|js|map)$/i;

// Cache for locale detection - stored in memory per server instance
// Consider Redis for multi-instance production deployment
let cachedLocale: string | null = null;
let localeCacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

function pathnameWithoutLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && isLocale(first)) {
    return { locale: first, rest: segments.slice(1) };
  }
  return { locale: null, rest: segments };
}

// Cache the accept-language detection to avoid parsing on every request
function getCachedLocale(acceptLanguage: string | null): string {
  const now = Date.now();
  if (cachedLocale && now - localeCacheTimestamp < CACHE_TTL && cachedLocale !== DEFAULT_LOCALE) {
    return cachedLocale;
  }
  cachedLocale = detectLocale(acceptLanguage);
  localeCacheTimestamp = now;
  return cachedLocale;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline" ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/fonts/") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const { locale: pathLocale, rest } = pathnameWithoutLocale(pathname);

  if (pathLocale) {
    const adminArea = rest[0] === "admin";
    const isLogin = adminArea && rest[1] === "login";
    const isInviteAccept = adminArea && rest[1] === "invite";
    const isSetup = adminArea && rest[1] === "setup";
    const isTelegramLogin = adminArea && rest[1] === "telegram-login";
    const hasSession = request.cookies.has(SESSION_COOKIE);

    if (
      adminArea &&
      !isLogin &&
      !isInviteAccept &&
      !isSetup &&
      !isTelegramLogin &&
      !hasSession
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${pathLocale}/admin/login`;
      url.search = "";
      return NextResponse.redirect(url);
    }

    const headers = new Headers(request.headers);
    headers.set("x-locale", pathLocale);
    const response = NextResponse.next({ request: { headers } });

    // Only set cookie if not already set (avoid unnecessary cookie operations)
    const existing = request.cookies.get(LOCALE_COOKIE)?.value;
    if (!existing) {
      response.cookies.set(LOCALE_COOKIE, pathLocale, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  // No locale in the path. Invalid locale-like prefixes are treated safely.
  const first = rest[0] ?? "";
  const invalidLocalePrefix = /^[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?$/.test(first) && !isLocale(first);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;

  // Use cached locale detection
  const acceptLanguage = request.headers.get("accept-language");
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : getCachedLocale(acceptLanguage);

  const url = request.nextUrl.clone();
  const tail = invalidLocalePrefix ? rest.slice(1) : rest;
  url.pathname = `/${locale}/${tail.join("/")}`.replace(/\/+$/, "") || `/${locale}`;
  url.search = search;
  const response = NextResponse.redirect(url);

  // Only set cookie if not already set
  if (!cookieLocale || !isLocale(cookieLocale)) {
    response.cookies.set(LOCALE_COOKIE, locale || DEFAULT_LOCALE, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
