import { describe, expect, it } from "vitest";

import {
  allVerificationChecksPassed,
  evaluateVerificationSnapshot
} from "../../../../lib/deploy/verification";

describe("verification parity", () => {
  it("returns 9 deterministic checks and all pass on valid snapshot", () => {
    const checks = evaluateVerificationSnapshot({
      communityId: 1,
      modules: { valuableActionRegistryMatches: true },
      vptInitialized: true,
      roles: {
        rrPositionManager: true,
        rrDistributor: true,
        commerceDisputesCaller: true,
        housingMarketplaceCaller: true,
        vaIssuerRequestHub: true
      },
      marketplaceActive: true,
      revenueTreasurySet: true
    });

    expect(checks).toHaveLength(9);
    expect(allVerificationChecksPassed(checks)).toBe(true);
  });

  it("includes explicit failure reasons for failing checks", () => {
    const checks = evaluateVerificationSnapshot({
      communityId: 1,
      modules: { valuableActionRegistryMatches: false },
      vptInitialized: false,
      roles: {
        rrPositionManager: false,
        rrDistributor: false,
        commerceDisputesCaller: false,
        housingMarketplaceCaller: false,
        vaIssuerRequestHub: false
      },
      marketplaceActive: false,
      revenueTreasurySet: false
    });

    expect(allVerificationChecksPassed(checks)).toBe(false);
    expect(checks.filter((c) => !c.passed).every((c) => Boolean(c.failureReason))).toBe(true);
  });
});
