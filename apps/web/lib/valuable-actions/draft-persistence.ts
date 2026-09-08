export type DraftStorage = Pick<Storage, "setItem">;
export type DraftReadStorage = Pick<Storage, "getItem">;

function resolveDefaultStorage(): (DraftStorage & DraftReadStorage) | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Best-effort persistence for governance prefill drafts. Storage failures
 * (quota, privacy mode, missing storage, serialization errors) never throw;
 * the caller learns via the boolean result whether the draft was saved.
 */
export function persistGovernanceDraft(
  key: string,
  payload: unknown,
  storage: DraftStorage | null = resolveDefaultStorage()
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort read of a governance prefill draft. Storage access failures
 * (storage disabled, privacy mode, security errors) never throw; callers get
 * `null` and fall back to their "complete the payload in admin" messaging.
 */
export function readGovernanceDraft(
  key: string,
  storage: DraftReadStorage | null = resolveDefaultStorage()
): string | null {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
