/**
 * Environment access with explicit, honest configuration status.
 * Nothing here invents credentials: an unset integration is reported as unset.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get appSecret(): string {
    const secret = process.env.APP_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        "APP_SECRET must be set to at least 32 characters. See .env.example.",
      );
    }
    return secret;
  },
  get siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  },
  get telegramBotToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  },
  get telegramWebhookSecret(): string | null {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
  },
  get telegramAdminChatId(): string | null {
    return process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || null;
  },
  get telegramBotUsername(): string | null {
    return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() || null;
  },
  get cronSecret(): string | null {
    return process.env.CRON_SECRET?.trim() || null;
  },
  get maxUploadBytes(): number {
    const mb = Number(process.env.MAX_UPLOAD_MB || "4");
    return (Number.isFinite(mb) && mb > 0 ? mb : 4) * 1024 * 1024;
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  /** Supabase project URL, e.g. https://abcdefgh.supabase.co. Server-only. */
  get supabaseUrl(): string | null {
    return process.env.SUPABASE_URL?.trim().replace(/\/+$/, "") || null;
  },
  /**
   * Supabase service-role key. Server-only: it bypasses row level security.
   * Never expose it to the browser and never prefix it with NEXT_PUBLIC_.
   */
  get supabaseServiceRoleKey(): string | null {
    return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
  },
  get supabasePublicBucket(): string {
    return process.env.SUPABASE_PUBLIC_BUCKET?.trim() || "media";
  },
  get supabasePrivateBucket(): string {
    return process.env.SUPABASE_PRIVATE_BUCKET?.trim() || "private";
  },
  /** True when running on a platform with an ephemeral, read-only filesystem. */
  get isServerless(): boolean {
    return Boolean(
      process.env.NETLIFY ||
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY_FUNCTIONS,
    );
  },
  get isTelegramConfigured(): boolean {
    return Boolean(this.telegramBotToken);
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};

export function telegramConfigStatus() {
  return {
    botToken: Boolean(env.telegramBotToken),
    webhookSecret: Boolean(env.telegramWebhookSecret),
    adminChatId: Boolean(env.telegramAdminChatId),
    botUsername: env.telegramBotUsername,
    cronSecret: Boolean(env.cronSecret),
    configured: env.isTelegramConfigured,
  };
}
