import { describe, expect, it } from "vitest";

import type { AllowlistTargetId } from "../../../../lib/actions/allowlist";
import { buildTargetAvailability } from "../../../../lib/actions/target-resolution";

describe("expert target resolution", () => {
  it("keeps targets visible but disabled when module is missing", () => {
    const targetIds: AllowlistTargetId[] = ["treasuryAdapter"];
    const availability = buildTargetAvailability(targetIds, 84532, {}, () => ["setTokenAllowed(address,bool)"]);

    expect(availability).toHaveLength(1);
    expect(availability[0]?.enabled).toBe(false);
    expect(availability[0]?.disabledReason).toBe("Module not configured for this community");
  });

  it("enables target only when module exists and allowlist has signatures", () => {
    const targetIds: AllowlistTargetId[] = ["draftsManager"];
    const availability = buildTargetAvailability(
      targetIds,
      84532,
      { draftsManager: "0x0000000000000000000000000000000000000001" },
      (targetId) => (targetId === "draftsManager" ? ["escalateToProposal(uint256)"] : [])
    );

    expect(availability[0]?.enabled).toBe(true);
    expect(availability[0]?.disabledReason).toBeNull();
  });

  it("shows deterministic reason when module exists but has no allowlisted functions", () => {
    const targetIds: AllowlistTargetId[] = ["draftsManager"];
    const availability = buildTargetAvailability(
      targetIds,
      84532,
      { draftsManager: "0x0000000000000000000000000000000000000001" },
      () => []
    );

    expect(availability[0]?.enabled).toBe(false);
    expect(availability[0]?.disabledReason).toBe("No timelock-allowlisted functions available");
  });
});
