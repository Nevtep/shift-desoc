import { describe, expect, it } from "vitest";

import { executeMutationByMode } from "../../../../hooks/useValuableActionAdminMutations";

describe("valuable action governance routing", () => {
  it("produces governance route result when mode is governance_required", async () => {
    const result = await executeMutationByMode("governance_required", {
      communityId: 1,
      actionId: 2,
      title: "Update action",
      metadataCid: "bafy-test-cid",
      category: "ENGAGEMENT_ONE_SHOT",
      verifierPolicy: "JURY",
      membershipTokenReward: 1,
      communityTokenReward: 0,
      jurorsMin: 3,
      panelSize: 5,
      verifyWindow: 3600,
      cooldownPeriod: 300,
      revocable: true,
      proposalThreshold: "0",
    });

    expect(result.route).toBe("governance");
    expect(result.status).toBe("submitted");
    expect(result.contractPayload?.membershipTokenReward).toBe(1);
    expect(result.contractPayload?.jurorsMin).toBe(3);
    expect(result.contractPayload?.panelSize).toBe(5);
  });

  it("rejects payloads that violate contract validation rules", async () => {
    await expect(
      executeMutationByMode("governance_required", {
        communityId: 1,
        title: "Invalid action",
        metadataCid: "",
        category: "ENGAGEMENT_ONE_SHOT",
        verifierPolicy: "JURY",
        membershipTokenReward: 0,
        jurorsMin: 0,
        panelSize: 0,
        verifyWindow: 0,
        cooldownPeriod: 0,
      })
    ).rejects.toThrow("MembershipToken reward cannot be zero.");
  });
});
