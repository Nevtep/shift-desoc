import { describe, expect, it } from "vitest";

import { mapValuableActionReadiness } from "../../../hooks/useValuableActionReadiness";

describe("mapValuableActionReadiness", () => {
  it("keeps healthy readiness when watermark is fresh", () => {
    const now = new Date("2026-01-01T00:01:00.000Z");
    const result = mapValuableActionReadiness(
      {
        status: "healthy",
        indexedAt: "2026-01-01T00:00:40.000Z",
      },
      now,
      90_000
    );

    expect(result.status).toBe("healthy");
    expect(result.isStale).toBe(false);
  });

  it("downgrades stale healthy payload to lagging", () => {
    const now = new Date("2026-01-01T00:03:00.000Z");
    const result = mapValuableActionReadiness(
      {
        status: "healthy",
        indexedAt: "2026-01-01T00:00:00.000Z",
      },
      now,
      30_000
    );

    expect(result.status).toBe("lagging");
    expect(result.isStale).toBe(true);
  });

  it("falls back to unavailable for unknown payload status", () => {
    const result = mapValuableActionReadiness({ status: "mystery" }, new Date("2026-01-01T00:00:00.000Z"));

    expect(result.status).toBe("unavailable");
  });
});
