import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale, SETTING_KEYS, type Locale, type Permission } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { getAdminSession, isOwner } from "@/lib/auth";
import { getSettings, settingString } from "@/lib/settings";
import { logoutAction } from "@/app/[locale]/admin/actions";
import {
  AuditIcon,
  BoxIcon,
  GridIcon,
  HomeIcon,
  ImageIcon,
  LogoutIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  CartIcon,
  TicketIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/site-header";

export const dynamic = "force-dynamic";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  permissions: Permission[];
  ownerOnly?: boolean;
};

export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);
  const ctx = await getAdminSession();
  if (!ctx) redirect(`/${locale}/admin/login`);

  const settings = await getSettings();
  const storeName = settingString(settings, SETTING_KEYS.storeName, locale) || "4AB NET";

  const can = (permission: Permission) => isOwner(ctx) || ctx.permissions.includes(permission);
  const canAny = (permissions: Permission[]) => permissions.some(can);

  const nav: NavItem[] = [
    {
      href: `/${locale}/admin`,
      label: t("admin.sections.overview"),
      icon: <GridIcon size={18} />,
      permissions: ["dashboard.view"],
    },
    {
      href: `/${locale}/admin/orders`,
      label: t("admin.sections.orders"),
      icon: <CartIcon size={18} />,
      permissions: ["orders.view"],
    },
    {
      href: `/${locale}/admin/coupons`,
      label: t("admin.sections.coupons"),
      icon: <TicketIcon size={18} />,
      permissions: ["coupons.manage"],
    },
    {
      href: `/${locale}/admin/products`,
      label: t("admin.sections.products"),
      icon: <BoxIcon size={18} />,
      permissions: ["products.manage"],
    },
    {
      href: `/${locale}/admin/categories`,
      label: t("admin.sections.categories"),
      icon: <HomeIcon size={18} />,
      permissions: ["categories.manage"],
    },
    {
      href: `/${locale}/admin/banners`,
      label: t("admin.sections.banners"),
      icon: <ImageIcon size={18} />,
      permissions: ["banners.manage"],
    },
    {
      href: `/${locale}/admin/inventory`,
      label: t("admin.sections.inventory"),
      icon: <ReceiptIcon size={18} />,
      permissions: ["inventory.manage", "inventory.deliver"],
    },
    {
      href: `/${locale}/admin/customers`,
      label: t("admin.sections.customers"),
      icon: <UsersIcon size={18} />,
      permissions: ["customers.view"],
    },
    {
      href: `/${locale}/admin/settings`,
      label: t("admin.sections.settings"),
      icon: <SettingsIcon size={18} />,
      permissions: [
        "settings.manage",
        "content.manage",
        "translations.manage",
        "telegram.manage",
      ],
    },
    {
      href: `/${locale}/admin/administrators`,
      label: t("admin.sections.administrators"),
      icon: <ShieldIcon size={18} />,
      permissions: ["admins.manage"],
      ownerOnly: true,
    },
    {
      href: `/${locale}/admin/audit`,
      label: t("admin.sections.audit"),
      icon: <AuditIcon size={18} />,
      permissions: ["audit.view"],
    },
  ];

  const visible = nav.filter((item) =>
    item.ownerOnly ? isOwner(ctx) : canAny(item.permissions),
  );

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <Link href={`/${locale}/admin`} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-ink">
              4AB
            </span>
            <span>
              <span className="block text-base font-extrabold leading-tight text-ink">{storeName}</span>
              <span className="block text-[11px] font-semibold text-muted">{t("admin.dashboard")}</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/${locale}`} className="btn btn-ghost btn-sm">
              {t("admin.sections.storefront")}
            </Link>
            <LanguageSwitcher compact />
            <div className="hidden text-end sm:block">
              <p className="text-xs text-muted">{t("admin.signedInAs")}</p>
              <p className="text-sm font-bold text-ink">{ctx.name}</p>
            </div>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="btn btn-secondary btn-sm">
                <LogoutIcon size={15} className="icon-directional" />
                {t("admin.logout")}
              </button>
            </form>
          </div>
        </div>

        {visible.length ? (
          <nav aria-label={t("admin.dashboard")} className="container-page flex gap-1 overflow-x-auto pb-2">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-brand-soft hover:text-brand-ink"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="container-page py-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="badge badge-brand">
            {isOwner(ctx) ? t("admin.roleOwner") : t("admin.roleAdmin")}
          </span>
          <span dir="ltr" className="ltr-value">{ctx.email}</span>
          {visible.length === 0 ? <span className="text-danger">{t("admin.noPermission")}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
