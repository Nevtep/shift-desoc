import { describe, expect, it } from "vitest";

import { mapValuableActionReadiness } from "../../../../hooks/useValuableActionReadiness";

describe("valuable action stale state guard", () => {
  it("does not keep stale payload as authoritative healthy", () => {
    const result = mapValuableActionReadiness(
      {
        status: "healthy",
        indexedAt: "2026-01-01T00:00:00.000Z",
      },
      new Date("2026-01-01T00:10:00.000Z"),
      60_000
    );

    expect(result.status).not.toBe("healthy");
  });
});
