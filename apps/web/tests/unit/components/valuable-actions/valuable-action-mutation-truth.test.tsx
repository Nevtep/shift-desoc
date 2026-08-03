import { describe, expect, it } from "vitest";

import { executeMutationByMode } from "../../../../hooks/useValuableActionAdminMutations";

describe("valuable action mutation status truth", () => {
  it("does not claim an on-chain submission for the direct write route", async () => {
    const result = await executeMutationByMode("direct_write", {
      communityId: 1,
      title: "Direct action",
      metadataCid: "bafy-test-cid",
      category: "ENGAGEMENT_ONE_SHOT",
      verifierPolicy: "JURY",
      membershipTokenReward: 1,
      jurorsMin: 1,
      panelSize: 3,
      verifyWindow: 3600,
      cooldownPeriod: 60,
    });

    expect(result.route).toBe("direct_write");
    expect(result.status).toBe("pending");
    expect(result.message).not.toMatch(/submitted/i);
  });

  it("does not claim a governance submission before the proposal builder runs", async () => {
    const result = await executeMutationByMode("governance_required", {
      communityId: 1,
      actionId: 2,
      title: "Update action",
      metadataCid: "bafy-test-cid",
      category: "ENGAGEMENT_ONE_SHOT",
      verifierPolicy: "JURY",
      membershipTokenReward: 1,
      jurorsMin: 1,
      panelSize: 3,
      verifyWindow: 3600,
      cooldownPeriod: 60,
    });

    expect(result.route).toBe("governance");
    expect(result.status).toBe("pending");
    expect(result.message).not.toMatch(/submitted/i);
  });
});
