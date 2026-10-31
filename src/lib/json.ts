/** JSON helpers with safe fallbacks. Values are stored as TEXT for portability. */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T = Record<string, unknown>>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value);
}
