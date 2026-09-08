import { describe, expect, it, vi } from "vitest";

import { persistGovernanceDraft, readGovernanceDraft } from "../../../../lib/valuable-actions/draft-persistence";

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

describe("readGovernanceDraft", () => {
  it("returns the stored raw draft", () => {
    const getItem = vi.fn(() => '{"title":"Test"}');

    expect(readGovernanceDraft("va-proposal-draft:1", { getItem })).toBe('{"title":"Test"}');
    expect(getItem).toHaveBeenCalledWith("va-proposal-draft:1");
  });

  it("never throws when storage reads fail and returns null", () => {
    const getItem = vi.fn(() => {
      throw new Error("SecurityError: storage disabled");
    });

    expect(() => readGovernanceDraft("va-proposal-draft:1", { getItem })).not.toThrow();
    expect(readGovernanceDraft("va-proposal-draft:1", { getItem })).toBeNull();
  });

  it("returns null when no storage is available", () => {
    expect(readGovernanceDraft("va-proposal-draft:1", null)).toBeNull();
  });
});
