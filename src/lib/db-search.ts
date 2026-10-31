/**
 * Text search helpers that behave the same on SQLite (local development) and
 * PostgreSQL (production).
 *
 * SQLite's `LIKE` is case-insensitive for ASCII by default, while PostgreSQL's
 * `LIKE` is case-sensitive. Prisma exposes `mode: "insensitive"` only for
 * PostgreSQL, so it is added conditionally — the SQLite query engine rejects
 * the option at runtime, and the SQLite-generated client omits it from its
 * types.
 *
 * The active engine is derived from DATABASE_URL, which must always match the
 * schema the Prisma client was generated from.
 */

export const isPostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "");

export type TextFilter = { contains: string; mode?: "insensitive" };

/** Substring match, case-insensitive on both engines. */
export function textContains(value: string): TextFilter {
  const trimmed = value.trim();
  return isPostgres ? { contains: trimmed, mode: "insensitive" } : { contains: trimmed };
}
