"use client";

type CacheEntry = {
  expiresAt: number;
  value: string;
};

const CACHE_PREFIX = "shift.manager.rpc.cache.v1";

function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") {
      return { __type: "bigint", value: v.toString() };
    }
    return v;
  });
}

function parseWithBigInt<T>(raw: string): T {
  return JSON.parse(raw, (_key, v) => {
    if (v && typeof v === "object" && v.__type === "bigint") {
      return BigInt(v.value);
    }
    return v;
  }) as T;
}

function toStorageKey(key: string): string {
  return `${CACHE_PREFIX}:${key}`;
}

export function readPersistentCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const storageKey = toStorageKey(key);
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed !== "object") {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (typeof parsed.value !== "string") {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parseWithBigInt<T>(parsed.value);
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writePersistentCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === "undefined") return;

  const storageKey = toStorageKey(key);
  const entry: CacheEntry = {
    expiresAt: Date.now() + Math.max(0, ttlMs),
    value: stringifyWithBigInt(value)
  };

  window.localStorage.setItem(storageKey, JSON.stringify(entry));
}

export async function getOrFetchPersistentCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = readPersistentCache<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  writePersistentCache(key, fresh, ttlMs);
  return fresh;
}
