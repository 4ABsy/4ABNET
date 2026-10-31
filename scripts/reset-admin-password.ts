/**
 * Local admin password recovery.
 *
 * There is no "forgot password" email flow in this project, so a forgotten
 * admin password is reset from the server that owns the database.
 *
 * Usage (from the project root):
 *   npm run admin:reset-password
 *   npm run admin:reset-password -- --email owner@example.com
 *   npm run admin:reset-password -- --password "my new long password"
 *
 * With no --password and an interactive terminal, it asks for the password
 * twice without echoing it. With no terminal (CI/script), it generates a
 * random temporary password and prints it once.
 *
 * The reset also revokes every existing session for that administrator.
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEYLEN = 64;
const MIN_LENGTH = 12;
const MAX_LENGTH = 200;

type Options = {
  email?: string;
  password?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--email" || arg.startsWith("--email=")) {
      options.email = arg.includes("=") ? arg.slice("--email=".length) : argv[++index];
    } else if (arg === "--password" || arg.startsWith("--password=")) {
      options.password = arg.includes("=") ? arg.slice("--password=".length) : argv[++index];
    }
  }
  return options;
}

function generatePassword(): string {
  // 24 random bytes -> 32 URL-safe characters, comfortably above the minimum.
  return randomBytes(24).toString("base64url");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (password.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters.`;
  return null;
}

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const mutable = rl as unknown as { _writeToOutput?: (value: string) => void };
  const original = mutable._writeToOutput;
  mutable._writeToOutput = () => undefined;
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => resolve(answer));
    });
  } finally {
    mutable._writeToOutput = original;
    rl.close();
    process.stdout.write("\n");
  }
}

async function readPassword(): Promise<{ password: string; generated: boolean }> {
  if (!process.stdin.isTTY) {
    return { password: generatePassword(), generated: true };
  }
  const first = await promptHidden("New password (hidden): ");
  const second = await promptHidden("Repeat new password (hidden): ");
  if (first !== second) throw new Error("Passwords do not match.");
  return { password: first, generated: false };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const admin = options.email
      ? await prisma.adminUser.findUnique({ where: { email: options.email.toLowerCase() } })
      : await prisma.adminUser.findFirst({ where: { role: "OWNER" } });

    if (!admin) {
      throw new Error(
        options.email
          ? `No administrator found with email ${options.email}.`
          : "No OWNER account found. Use --email to target a specific administrator.",
      );
    }

    let password = options.password;
    let generated = false;
    if (!password) {
      const result = await readPassword();
      password = result.password;
      generated = result.generated;
    }

    const invalid = validatePassword(password);
    if (invalid) throw new Error(invalid);

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash, status: "ACTIVE" },
      }),
      prisma.adminSession.deleteMany({ where: { adminId: admin.id } }),
      prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "admin.passwordReset",
          entityType: "AdminUser",
          entityId: admin.id,
          details: JSON.stringify({ via: "scripts/reset-admin-password.ts" }),
        },
      }),
    ]);

    console.log(`Password reset for ${admin.email} (${admin.role}).`);
    console.log("All existing sessions for this account were revoked.");
    if (generated) {
      console.log("");
      console.log(`Temporary password: ${password}`);
      console.log("Sign in, then change it with:");
      console.log('  npm run admin:reset-password -- --password "your new password"');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
