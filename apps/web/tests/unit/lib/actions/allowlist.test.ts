import { describe, expect, it } from "vitest";

import {
  getAllowlistedSignatures,
  getCanonicalAllowlistMeta,
  getCanonicalAllowlistProfile,
  listAllowlistProfiles
} from "../../../../lib/actions/allowlist";

describe("allowlist", () => {
  it("loads a single canonical profile", () => {
    const profiles = listAllowlistProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].profileId).toBe("base-sepolia-v1");
  });

  it("keeps deterministic sorted target and signature ordering", () => {
    const profile = getCanonicalAllowlistProfile();
    const targetIds = profile.targets.map((target) => target.targetId);
    const sortedTargetIds = [...targetIds].sort((a, b) => a.localeCompare(b));
    expect(targetIds).toEqual(sortedTargetIds);

    for (const target of profile.targets) {
      const sorted = [...target.signatures].sort((a, b) => a.localeCompare(b));
      expect(target.signatures).toEqual(sorted);
    }
  });

  it("enforces treasury adapter ABI reality signatures", () => {
    const signatures = getAllowlistedSignatures("treasuryAdapter");
    expect(signatures).toContain("setCapBps(address,uint16)");
    expect(signatures).toContain("setDestinationAllowed(address,bool)");
    expect(signatures).toContain("setTokenAllowed(address,bool)");
  });

  it("includes metadata with zero ABI validation failures", () => {
    const meta = getCanonicalAllowlistMeta();
    expect(meta.abiValidationFailures).toEqual([]);
    expect(meta.profileId).toBe("base-sepolia-v1");
  });
});
