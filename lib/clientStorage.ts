export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      fallback !== null &&
      typeof fallback === "object" &&
      !Array.isArray(fallback)
    ) {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        return fallback;
      const saved = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(fallback).map(([name, defaultValue]) => {
          const candidate = saved[name];
          const valid =
            typeof candidate === typeof defaultValue &&
            (typeof candidate !== "number" ||
              (Number.isFinite(candidate) && candidate >= 0));
          return [name, valid ? candidate : defaultValue];
        }),
      ) as T;
    }
    return typeof value === typeof fallback ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be denied or full. */
  }
}
