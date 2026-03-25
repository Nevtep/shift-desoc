import { describe, expect, it } from "vitest";

import { mapOverviewActivity, OVERVIEW_ACTIVITY_LIMIT } from "../../../lib/community-overview/activity";

describe("community overview activity panels", () => {
  it("limits each panel to latest N=3 items", () => {
    const nodes = [1, 2, 3, 4, 5].map((n) => ({
      id: String(n),
      status: "OPEN",
      createdAt: new Date(2026, 0, n).toISOString()
    }));

    const items = mapOverviewActivity("requests", nodes);
    expect(items).toHaveLength(OVERVIEW_ACTIVITY_LIMIT);
    expect(items[0].id).toBe("1");
    expect(items[2].id).toBe("3");
  });
});
