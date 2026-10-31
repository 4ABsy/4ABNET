import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { tr } from "@/lib/i18n/dictionaries/tr";

type Leaf = { path: string; kind: "string" | "array"; length?: number };

function collectLeaves(value: unknown, prefix: string, out: Leaf[]) {
  if (Array.isArray(value)) {
    out.push({ path: prefix, kind: "array", length: value.length });
    value.forEach((entry, index) => collectLeaves(entry, `${prefix}[${index}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectLeaves(entry, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.push({ path: prefix, kind: "string" });
}

function leaves(dictionary: unknown): Map<string, Leaf> {
  const result: Leaf[] = [];
  collectLeaves(dictionary, "", result);
  return new Map(result.map((leaf) => [leaf.path, leaf]));
}

describe("translation dictionaries", () => {
  const reference = leaves(ar);

  for (const [name, dictionary] of [
    ["en", en],
    ["tr", tr],
  ] as const) {
    it(`${name} has exactly the same keys and array sizes as Arabic`, () => {
      const candidate = leaves(dictionary);
      const missing = [...reference.keys()].filter((path) => !candidate.has(path));
      const extra = [...candidate.keys()].filter((path) => !reference.has(path));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);

      for (const [path, leaf] of reference) {
        const other = candidate.get(path);
        expect(other?.kind, path).toBe(leaf.kind);
        if (leaf.kind === "array") {
          expect(other?.length, path).toBe(leaf.length);
        }
      }
    });
  }
});
