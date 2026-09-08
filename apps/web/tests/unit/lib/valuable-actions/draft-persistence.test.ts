import { describe, expect, it, vi } from "vitest";

import { persistGovernanceDraft } from "../../../../lib/valuable-actions/draft-persistence";

describe("persistGovernanceDraft", () => {
  it("persists the serialized payload and reports success", () => {
    const setItem = vi.fn();

    const persisted = persistGovernanceDraft("va-proposal-draft:1", { title: "Test" }, { setItem });

    expect(persisted).toBe(true);
    expect(setItem).toHaveBeenCalledWith("va-proposal-draft:1", JSON.stringify({ title: "Test" }));
  });

  it("never throws when storage writes fail and reports failure", () => {
    const setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => persistGovernanceDraft("va-proposal-draft:1", { title: "Test" }, { setItem })).not.toThrow();
    expect(persistGovernanceDraft("va-proposal-draft:1", { title: "Test" }, { setItem })).toBe(false);
  });

  it("reports failure when no storage is available", () => {
    expect(persistGovernanceDraft("va-proposal-draft:1", { title: "Test" }, null)).toBe(false);
  });

  it("never throws on unserializable payloads", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(persistGovernanceDraft("va-proposal-draft:1", cyclic, { setItem: vi.fn() })).toBe(false);
  });
});
