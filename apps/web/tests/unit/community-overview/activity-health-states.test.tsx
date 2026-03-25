import { describe, expect, it } from "vitest";

import { INDEXER_LAG_THRESHOLD_SECONDS } from "../../../lib/community-overview/constants";
import { resolveIndexerHealth } from "../../../hooks/useIndexerHealth";

describe("community overview activity health states", () => {
  it("marks lagging when newest preview is older than threshold", () => {
    const now = new Date("2026-03-25T00:00:00.000Z");
    const stale = new Date(now.getTime() - (INDEXER_LAG_THRESHOLD_SECONDS + 1) * 1000).toISOString();

    const state = resolveIndexerHealth({
      apiHealthy: true,
      apiError: false,
      newestPreviewTimestamp: stale,
      now,
      lagThresholdSeconds: INDEXER_LAG_THRESHOLD_SECONDS
    });

    expect(state).toBe("lagging");
  });

  it("marks unknown when there is no preview timestamp", () => {
    const state = resolveIndexerHealth({
      apiHealthy: true,
      apiError: false,
      newestPreviewTimestamp: null,
      now: new Date()
    });
    expect(state).toBe("unknown");
  });

  it("marks error when indexer health endpoint fails", () => {
    const state = resolveIndexerHealth({
      apiHealthy: false,
      apiError: true,
      newestPreviewTimestamp: new Date().toISOString(),
      now: new Date()
    });
    expect(state).toBe("error");
  });
});
