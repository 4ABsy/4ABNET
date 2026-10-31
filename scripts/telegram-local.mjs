#!/usr/bin/env node
/**
 * Local Telegram development helper.
 *
 * Telegram webhooks need a public HTTPS URL. For local testing this script
 * long-polls getUpdates and forwards each update to the local webhook route,
 * so the same server-side verification and callback logic is exercised.
 *
 * Commands:
 *   node scripts/telegram-local.mjs info
 *   node scripts/telegram-local.mjs discover
 *   node scripts/telegram-local.mjs bridge
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");
const LOCAL_URL =
  process.env.LOCAL_WEBHOOK_URL ||
  `http://127.0.0.1:${process.env.PORT || "3000"}/api/telegram/webhook`;

function readEnvFile() {
  if (!existsSync(ENV_PATH)) {
    throw new Error("ملف .env غير موجود. انسخ .env.example إلى .env أولًا.");
  }
  const values = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function setEnvValue(key, value) {
  const text = readFileSync(ENV_PATH, "utf8");
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const line = `${key}="${escaped}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.replace(/\s*$/, "")}\n${line}\n`;
  writeFileSync(ENV_PATH, next, "utf8");
}

function tokenFrom(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN فارغ في .env. ضع توكن BotFather أولًا.");
  }
  return token;
}

async function telegram(method, payload, token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!body.ok) {
    throw new Error(`${method}: ${body.description || `HTTP ${response.status}`}`);
  }
  return body.result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function info() {
  const env = readEnvFile();
  const token = tokenFrom(env);
  const me = await telegram("getMe", {}, token);
  const webhook = await telegram("getWebhookInfo", {}, token);
  console.log(`البوت: @${me.username} — ${me.first_name}`);
  console.log(`Webhook: ${webhook.url || "(لا يوجد)"}`);
  console.log(`التحديثات المعلقة: ${webhook.pending_update_count ?? 0}`);
  if (webhook.last_error_message) {
    console.log(`آخر خطأ: ${webhook.last_error_message}`);
  }
  console.log(`TELEGRAM_ADMIN_CHAT_ID: ${env.TELEGRAM_ADMIN_CHAT_ID || "(فارغ)"}`);
  console.log(`TELEGRAM_BOT_USERNAME: ${env.TELEGRAM_BOT_USERNAME || "(فارغ)"}`);
  console.log(`TELEGRAM_WEBHOOK_SECRET: ${env.TELEGRAM_WEBHOOK_SECRET ? "(مضبوط)" : "(فارغ)"}`);
}

async function discover() {
  const env = readEnvFile();
  const token = tokenFrom(env);
  const me = await telegram("getMe", {}, token);

  console.log(`البوت: @${me.username} — ${me.first_name}`);
  console.log("إزالة أي Webhook مؤقتًا حتى نتمكن من السحب المحلي...");
  await telegram("deleteWebhook", { drop_pending_updates: true }, token);

  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    const secret = randomBytes(24)
      .toString("base64url")
      .replace(/[^A-Za-z0-9_-]/g, "");
    setEnvValue("TELEGRAM_WEBHOOK_SECRET", secret);
    env.TELEGRAM_WEBHOOK_SECRET = secret;
    console.log("تم توليد TELEGRAM_WEBHOOK_SECRET وحفظه في .env");
  }

  setEnvValue("TELEGRAM_BOT_USERNAME", me.username);
  if (!env.NEXT_PUBLIC_SITE_URL) {
    setEnvValue("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  }

  console.log("");
  console.log(`أرسل الآن /start إلى @${me.username} من المحادثة التي تريد استلام إشعارات الطلبات فيها.`);
  console.log("انتظار الرسالة...\n");

  let offset = 0;
  for (;;) {
    const updates = await telegram(
      "getUpdates",
      { offset, timeout: 25, allowed_updates: ["message", "callback_query"] },
      token,
    );
    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      const from = message?.from || update.callback_query?.from;
      const chat = message?.chat || update.callback_query?.message?.chat;
      if (!chat) continue;

      console.log(`Chat ID: ${chat.id}`);
      console.log(`نوع المحادثة: ${chat.type}`);
      console.log(`Telegram ID للمستخدم: ${from?.id ?? "غير معروف"}`);
      console.log(`اسم المستخدم: @${from?.username ?? "لا يوجد"}`);
      if (message?.text) console.log(`النص: ${message.text}`);

      setEnvValue("TELEGRAM_ADMIN_CHAT_ID", String(chat.id));
      setEnvValue("TELEGRAM_BOT_USERNAME", me.username);

      console.log("");
      console.log("تم الحفظ في .env:");
      console.log(`  TELEGRAM_ADMIN_CHAT_ID=${chat.id}`);
      console.log(`  TELEGRAM_BOT_USERNAME=${me.username}`);
      console.log("");
      console.log(`ضع هذا الرقم في حقل Telegram ID داخل لوحة الإدارة: ${from?.id ?? "غير معروف"}`);
      console.log("أعد تشغيل الموقع، ثم شغّل: npm run telegram:bridge");
      return;
    }
  }
}

async function bridge() {
  const env = readEnvFile();
  const token = tokenFrom(env);
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET فارغ. شغّل npm run telegram:discover أولًا.",
    );
  }

  const me = await telegram("getMe", {}, token);
  await telegram("deleteWebhook", { drop_pending_updates: false }, token);

  console.log(`البوت: @${me.username}`);
  console.log(`تمرير التحديثات إلى: ${LOCAL_URL}`);
  console.log("اترك هذه النافذة مفتوحة. أوقف بـ Ctrl+C.\n");

  let offset = 0;
  for (;;) {
    let updates;
    try {
      updates = await telegram(
        "getUpdates",
        { offset, timeout: 25, allowed_updates: ["message", "callback_query"] },
        token,
      );
    } catch (error) {
      console.error(`[poll] ${error.message}`);
      await sleep(2000);
      continue;
    }

    for (const update of updates) {
      const label = update.message
        ? `رسالة من ${update.message.from?.username || update.message.from?.id || "?"}`
        : update.callback_query
          ? `زر ${update.callback_query.data || "?"}`
          : "تحديث";

      let delivered = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(LOCAL_URL, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-telegram-bot-api-secret-token": secret,
            },
            body: JSON.stringify(update),
            signal: AbortSignal.timeout(15_000),
          });
          const text = await response.text();
          console.log(
            `[${update.update_id}] ${label} → ${response.status} ${text.slice(0, 160)}`,
          );
          if (response.ok) {
            delivered = true;
            break;
          }
        } catch (error) {
          console.error(
            `[${update.update_id}] محاولة ${attempt} فشلت: ${error.message}`,
          );
        }
        await sleep(1000);
      }

      if (!delivered) {
        console.error(
          `[${update.update_id}] لم يُسلَّم. تأكد أن الموقع يعمل على ${LOCAL_URL}`,
        );
      }
      offset = update.update_id + 1;
    }
  }
}

async function main() {
  const command = process.argv[2] || "help";
  if (command === "info") {
    await info();
  } else if (command === "discover") {
    await discover();
  } else if (command === "bridge") {
    await bridge();
  } else {
    console.log("الاستخدام:");
    console.log("  npm run telegram:info      عرض حالة البوت والـ Webhook");
    console.log("  npm run telegram:discover  حفظ Chat ID واسم البوت في .env");
    console.log("  npm run telegram:bridge    تمرير تحديثات تلجرام إلى الموقع محليًا");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nخطأ: ${error.message}`);
  process.exitCode = 1;
});
