import { describe, expect, it } from "vitest";

import { buildOverviewHeaderState } from "../../../hooks/useCommunityOverview";

describe("community overview authority actions", () => {
  it("keeps view parameters enabled and edit disabled when unauthorized", () => {
    const header = buildOverviewHeaderState({
      communityId: 1,
      displayName: "Community #1",
      health: "synced",
      canEdit: false
    });

    expect(header.actions.viewParameters.enabled).toBe(true);
    expect(header.actions.editParameters.enabled).toBe(false);
    expect(header.actions.editParameters.comingSoon).toBe(true);
  });

  it("enables edit parameters when authorized", () => {
    const header = buildOverviewHeaderState({
      communityId: 1,
      displayName: "Community #1",
      health: "synced",
      canEdit: true
    });

    expect(header.actions.editParameters.enabled).toBe(true);
    expect(header.actions.editParameters.comingSoon).toBe(false);
  });
});
