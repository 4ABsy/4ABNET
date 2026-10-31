import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/constants";
import { createI18n } from "@/lib/i18n";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin invitation",
  robots: { index: false, follow: false },
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: rawLocale, token } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { t } = createI18n(locale);

  const invitation = token
    ? await prisma.adminInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
    : null;

  const valid =
    invitation &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt.getTime() > Date.now();

  if (!valid) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <h1 className="text-xl font-extrabold text-ink">{t("admin.admins.inviteInvalid")}</h1>
        <Link href={`/${locale}/admin/login`} className="btn btn-secondary mt-5">
          {t("admin.setup.goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <AcceptInviteForm
      locale={locale}
      token={token}
      name={invitation.name}
      email={invitation.email}
    />
  );
}
