"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Dictionary } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
  t: (key: string, vars?: Record<string, string | number>) => string;
  money: (minor: number) => string;
  date: (value: Date | string) => string;
  percent: (value: number) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside Providers");
  return ctx;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
type ToastContextValue = { notify: (message: string, tone?: Toast["tone"]) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside Providers");
  return ctx;
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`animate-fade-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1 ${
            toast.tone === "error"
              ? "bg-white text-danger ring-danger/20"
              : toast.tone === "success"
                ? "bg-white text-success ring-success/20"
                : "bg-ink text-white ring-black/10"
          }`}
        >
          <span className="mt-0.5" aria-hidden="true">
            {toast.tone === "error" ? "⚠" : toast.tone === "success" ? "✓" : "ℹ"}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="rounded-md px-1 text-xs opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cart (client-side basket; all prices are re-calculated on the server)
// ---------------------------------------------------------------------------

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceMinor: number;
  imageUrl: string | null;
  quantity: number;
  maxQty: number;
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  totalMinor: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "4ab_cart_v1";

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside Providers");
  return ctx;
}

function readCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CartItem =>
          !!item &&
          typeof item === "object" &&
          typeof (item as CartItem).productId === "string" &&
          typeof (item as CartItem).name === "string" &&
          Number.isInteger((item as CartItem).priceMinor) &&
          Number.isInteger((item as CartItem).quantity),
      )
      .map((item) => ({ ...item, quantity: Math.max(1, Math.min(item.quantity, 10)) }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------

export function Providers({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const i18n = useMemo<I18nContextValue>(() => {
    const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      dict: dictionary,
      t: (key, vars) => translate(dictionary, key, vars),
      money: (minor) =>
        new Intl.NumberFormat(intlLocale, {
          style: "currency",
          currency: "TRY",
          currencyDisplay: "narrowSymbol",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minor / 100),
      date: (value) =>
        new Intl.DateTimeFormat(intlLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Istanbul",
        }).format(typeof value === "string" ? new Date(value) : value),
      percent: (value) =>
        new Intl.NumberFormat(intlLocale, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(value),
    };
  }, [locale, dictionary]);

  // Cart
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // storage may be unavailable (private mode); the cart still works in memory
    }
  }, [items, hydrated]);

  const persist = useCallback((updater: (current: CartItem[]) => CartItem[]) => {
    setItems((current) => updater(current).slice(0, 30));
  }, []);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      persist((current) => {
        const existing = current.find((entry) => entry.productId === item.productId);
        if (existing) {
          return current.map((entry) =>
            entry.productId === item.productId
              ? {
                  ...entry,
                  ...item,
                  quantity: Math.min(
                    Math.max(1, quantity === 1 ? entry.quantity + 1 : quantity),
                    item.maxQty || 10,
                    10,
                  ),
                }
              : entry,
          );
        }
        return [
          ...current,
          {
            ...item,
            quantity: Math.min(Math.max(1, quantity), item.maxQty || 10, 10),
          },
        ];
      });
      notify(
        translate(dictionary, "product.added"),
        "success",
      );
    },
    [dictionary, notify, persist],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      persist((current) =>
        current.map((entry) =>
          entry.productId === productId
            ? {
                ...entry,
                quantity: Math.max(1, Math.min(quantity, entry.maxQty || 10, 10)),
              }
            : entry,
        ),
      );
    },
    [persist],
  );

  const remove = useCallback(
    (productId: string) => {
      persist((current) => current.filter((entry) => entry.productId !== productId));
    },
    [persist],
  );

  const clear = useCallback(() => setItems([]), []);

  const cart = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalMinor = items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);
    return { items, hydrated, count, totalMinor, add, setQuantity, remove, clear };
  }, [items, hydrated, add, setQuantity, remove, clear]);

  return (
    <I18nContext.Provider value={i18n}>
      <ToastContext.Provider value={{ notify }}>
        <CartContext.Provider value={cart}>
          {children}
          <ToastViewport toasts={toasts} dismiss={dismiss} />
        </CartContext.Provider>
      </ToastContext.Provider>
    </I18nContext.Provider>
  );
}
