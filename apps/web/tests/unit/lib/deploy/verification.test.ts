import { describe, expect, it } from "vitest";

import {
  allVerificationChecksPassed,
  evaluateVerificationSnapshot
} from "../../../../lib/deploy/verification";

describe("verification parity", () => {
  it("returns deterministic checks and all pass on valid snapshot", () => {
    const checks = evaluateVerificationSnapshot({
      communityId: 1,
      modules: { valuableActionRegistryMatches: true },
      vptInitialized: true,
      roles: {
        rrPositionManager: true,
        verifierManagerCallerEngagements: true,
        rrDistributor: true,
        commerceDisputesCaller: true,
        cohortRevenueRouter: true,
        housingMarketplaceCaller: true,
        cohortInvestmentRecorder: true,
        vaIssuerRequestHub: true,
        vaIssuerPositionManager: true,
        vaIssuerInvestmentCohortManager: true,
        vaIssuerCredentialManager: true,
        membershipMinterEngagements: true,
        vaSbtManagerRegistry: true
      },
      marketplaceActive: true,
      revenueTreasurySet: true
    });

    expect(checks).toHaveLength(17);
    expect(allVerificationChecksPassed(checks)).toBe(true);
  });

  it("includes explicit failure reasons for failing checks", () => {
    const checks = evaluateVerificationSnapshot({
      communityId: 1,
      modules: { valuableActionRegistryMatches: false },
      vptInitialized: false,
      roles: {
        rrPositionManager: false,
        verifierManagerCallerEngagements: false,
        rrDistributor: false,
        commerceDisputesCaller: false,
        cohortRevenueRouter: false,
        housingMarketplaceCaller: false,
        cohortInvestmentRecorder: false,
        vaIssuerRequestHub: false,
        vaIssuerPositionManager: false,
        vaIssuerInvestmentCohortManager: false,
        vaIssuerCredentialManager: false,
        membershipMinterEngagements: false,
        vaSbtManagerRegistry: false
      },
      marketplaceActive: false,
      revenueTreasurySet: false
    });

    expect(allVerificationChecksPassed(checks)).toBe(false);
    expect(checks.filter((c) => !c.passed).every((c) => Boolean(c.failureReason))).toBe(true);
  });
});
