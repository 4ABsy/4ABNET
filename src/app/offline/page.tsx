import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "غير متصل — Offline",
  robots: { index: false, follow: false },
};

/**
 * Offline fallback used by the service worker for navigation requests.
 * It is intentionally trilingual and contains no order or account data.
 */
export default function OfflinePage() {
  return (
    <main className="container-page flex min-h-dvh max-w-xl flex-col justify-center py-16">
      <div className="card p-7 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-lg font-extrabold text-ink">
          4AB
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-ink" lang="ar">
          أنت غير متصل
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted" lang="ar">
          تحقق من اتصالك بالإنترنت ثم أعد المحاولة. لا يمكن إتمام الشراء أو فتح بيانات التسليم دون اتصال.
        </p>
        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-lg font-bold text-ink" lang="en">
            You are offline
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted" lang="en">
            Check your connection and try again. Checkout and secure delivery data require an internet connection.
          </p>
        </div>
        <div className="mt-5">
          <h2 className="text-base font-bold text-ink" lang="tr">
            Çevrimdışısınız
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted" lang="tr">
            Bağlantınızı kontrol edip tekrar deneyin. Ödeme ve güvenli teslimat verileri internet bağlantısı gerektirir.
          </p>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/ar" className="btn btn-primary btn-sm">
            العربية
          </Link>
          <Link href="/en" className="btn btn-secondary btn-sm">
            English
          </Link>
          <Link href="/tr" className="btn btn-secondary btn-sm">
            Türkçe
          </Link>
        </div>
      </div>
    </main>
  );
}
