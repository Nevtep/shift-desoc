import { describe, expect, it } from "vitest";

import { mapValuableActionReadiness } from "../../../../hooks/useValuableActionReadiness";

describe("valuable action activation readiness", () => {
  it("shows lagging after stale projection catch-up window", () => {
    const readiness = mapValuableActionReadiness(
      {
        status: "healthy",
        indexedAt: "2026-01-01T00:00:00.000Z",
      },
      new Date("2026-01-01T00:05:00.000Z"),
      30_000
    );

    expect(readiness.status).toBe("lagging");
  });
});
