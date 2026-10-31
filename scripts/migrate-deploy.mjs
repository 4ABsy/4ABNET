/**
 * Applies PostgreSQL migrations to the production database.
 *
 * Supabase exposes two connection strings:
 * - DATABASE_URL: transaction pooler (port 6543) used by the running app.
 * - DIRECT_URL:   session pooler or direct connection (port 5432), required for
 *                 DDL and advisory locks used by Prisma Migrate.
 *
 * Prisma Migrate needs the direct (non-pooled) connection. The schema declares
 * `directUrl = env("DIRECT_URL")`, so we pass DIRECT_URL through unchanged and
 * never override DATABASE_URL — the pooler URL stays as-is for runtime queries.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!directUrl && !databaseUrl) {
  console.error("DATABASE_URL (or DIRECT_URL) is required to apply migrations.");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const result = spawnSync(
  isWindows ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"],
  {
    stdio: "inherit",
    shell: isWindows,
    env: {
      ...process.env,
      // Prisma Migrate uses directUrl (DIRECT_URL). If DIRECT_URL is missing,
      // fall back to DATABASE_URL so the script still works in local dev.
      ...(directUrl ? {} : { DIRECT_URL: databaseUrl }),
    },
  },
);

process.exit(result.status ?? 1);
