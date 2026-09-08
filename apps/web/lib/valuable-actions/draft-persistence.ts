export type DraftStorage = Pick<Storage, "setItem">;

function resolveDefaultStorage(): DraftStorage | null {
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
