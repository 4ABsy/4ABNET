/**
 * Applies PostgreSQL migrations to the production database.
 *
 * Supabase exposes two connection strings:
 * - DATABASE_URL: transaction pooler (port 6543) used by the running app.
 * - DIRECT_URL:   session pooler or direct connection (port 5432), required for
 *                 DDL and advisory locks used by Prisma Migrate.
 *
 * DIRECT_URL is optional: when it is unset, DATABASE_URL is used.
 */
import { spawnSync } from "node:child_process";

const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!url) {
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
    env: { ...process.env, DATABASE_URL: url },
  },
);

process.exit(result.status ?? 1);
