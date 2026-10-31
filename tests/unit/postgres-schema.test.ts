import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toPostgresSchema } from "../../scripts/postgres-schema.mjs";

const root = process.cwd();

function modelsOf(schema: string): string[] {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]!);
}

describe("PostgreSQL schema generation", () => {
  it("keeps the committed production schema in sync with the source schema", async () => {
    const source = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
    const committed = await readFile(
      path.join(root, "prisma", "postgres", "schema.prisma"),
      "utf8",
    );

    expect(committed).toBe(toPostgresSchema(source));
  });

  it("switches the provider and adds the Lambda binary target", async () => {
    const source = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
    const generated = toPostgresSchema(source);

    expect(generated).toContain('provider = "postgresql"');
    expect(generated).not.toContain('provider = "sqlite"');
    expect(generated).toContain('binaryTargets = ["native", "rhel-openssl-3.0.x"]');
  });

  it("declares the PostgreSQL provider in the migration lock file", async () => {
    const lock = await readFile(
      path.join(root, "prisma", "postgres", "migrations", "migration_lock.toml"),
      "utf8",
    );

    // A stray space or an escaped "\n" here makes `prisma migrate deploy`
    // fail with P3019, so assert the exact line rather than a loose match.
    const providerLines = lock.split("\n").filter((line) => line.startsWith("provider"));
    expect(providerLines).toEqual(['provider = "postgresql"']);
  });

  it("declares the same models as the source schema", async () => {
    const source = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
    const generated = toPostgresSchema(source);

    expect(modelsOf(generated)).toEqual(modelsOf(source));
    expect(modelsOf(source).length).toBeGreaterThan(20);
  });
});
