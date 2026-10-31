import { afterEach, describe, expect, it, vi } from "vitest";

const originalUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  vi.resetModules();
});

async function load(databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  vi.resetModules();
  return import("@/lib/db-search");
}

describe("text search filters", () => {
  it("uses case-insensitive mode on PostgreSQL", async () => {
    const { isPostgres, textContains } = await load("postgresql://u:p@h:5432/db");

    expect(isPostgres).toBe(true);
    expect(textContains("  Pixel ")).toEqual({ contains: "Pixel", mode: "insensitive" });
  });

  it("omits the unsupported mode option on SQLite", async () => {
    const { isPostgres, textContains } = await load("file:../data/dev.db");

    expect(isPostgres).toBe(false);
    expect(textContains("  Pixel ")).toEqual({ contains: "Pixel" });
    expect(textContains("Pixel")).not.toHaveProperty("mode");
  });

  it("also recognises the postgres:// scheme", async () => {
    const { isPostgres } = await load("postgres://u:p@h:5432/db");
    expect(isPostgres).toBe(true);
  });
});
