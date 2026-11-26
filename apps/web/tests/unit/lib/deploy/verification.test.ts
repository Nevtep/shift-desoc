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

  describe("authority mode checks", () => {
    const base = {
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
    };
    const pick = (checks: ReturnType<typeof evaluateVerificationSnapshot>) =>
      Object.fromEntries(checks.filter((c) => c.key.startsWith("AUTHORITY_")).map((c) => [c.key, c]));

    it("keeps the 17 legacy checks and adds none without a mode", () => {
      expect(evaluateVerificationSnapshot(base)).toHaveLength(17);
    });

    it("admin_managed passes when deployer holds ADMIN and timelock/coordinator do not", () => {
      const checks = evaluateVerificationSnapshot(
        { ...base, authority: { deployer: true, timelock: false, bootstrapCoordinator: false } },
        "admin_managed"
      );
      expect(checks).toHaveLength(20);
      const a = pick(checks);
      expect(a.AUTHORITY_DEPLOYER_ADMIN).toMatchObject({ passed: true, polarity: "positive" });
      expect(a.AUTHORITY_TIMELOCK_ADMIN).toMatchObject({ passed: true, polarity: "negative" });
      expect(a.AUTHORITY_BOOTSTRAP_ADMIN).toMatchObject({ passed: true, polarity: "negative" });
      expect(allVerificationChecksPassed(checks)).toBe(true);
    });

    it("governance_managed passes when timelock holds ADMIN and deployer/coordinator do not", () => {
      const checks = evaluateVerificationSnapshot(
        { ...base, authority: { deployer: false, timelock: true, bootstrapCoordinator: false } },
        "governance_managed"
      );
      const a = pick(checks);
      expect(a.AUTHORITY_TIMELOCK_ADMIN).toMatchObject({ passed: true, polarity: "positive" });
      expect(a.AUTHORITY_DEPLOYER_ADMIN).toMatchObject({ passed: true, polarity: "negative" });
      expect(allVerificationChecksPassed(checks)).toBe(true);
    });

    it("admin_managed outcome fails governance_managed verification and blocks completion", () => {
      const checks = evaluateVerificationSnapshot(
        { ...base, authority: { deployer: true, timelock: false, bootstrapCoordinator: false } },
        "governance_managed"
      );
      const a = pick(checks);
      expect(a.AUTHORITY_TIMELOCK_ADMIN.passed).toBe(false);
      expect(a.AUTHORITY_DEPLOYER_ADMIN.passed).toBe(false);
      expect(a.AUTHORITY_DEPLOYER_ADMIN.failureReason).toMatch(/deployer/i);
      expect(allVerificationChecksPassed(checks)).toBe(false);
    });

    it("a lingering bootstrap coordinator ADMIN fails either mode", () => {
      for (const mode of ["admin_managed", "governance_managed"] as const) {
        const authority =
          mode === "admin_managed"
            ? { deployer: true, timelock: false, bootstrapCoordinator: true }
            : { deployer: false, timelock: true, bootstrapCoordinator: true };
        const checks = evaluateVerificationSnapshot({ ...base, authority }, mode);
        expect(pick(checks).AUTHORITY_BOOTSTRAP_ADMIN.passed).toBe(false);
        expect(allVerificationChecksPassed(checks)).toBe(false);
      }
    });

    it("passes the coordinator check when no coordinator is configured", () => {
      const checks = evaluateVerificationSnapshot(
        { ...base, authority: { deployer: true, timelock: false } },
        "admin_managed"
      );
      expect(pick(checks).AUTHORITY_BOOTSTRAP_ADMIN.passed).toBe(true);
    });

    it("fails closed when a mode is selected but ADMIN holders were not read", () => {
      const checks = evaluateVerificationSnapshot(base, "admin_managed");
      expect(checks).toHaveLength(20);
      expect(Object.values(pick(checks)).every((c) => !c.passed)).toBe(true);
      expect(allVerificationChecksPassed(checks)).toBe(false);
    });
  });
});

describe("initial voting power checks", () => {
  const snapshot = {
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
  };
  const ONE = 10n ** 18n;
  const find = (checks: ReturnType<typeof evaluateVerificationSnapshot>, key: string) => checks.find((c) => c.key === key)!;

  it("adds no checks when the snapshot carries no initial voting power data", () => {
    expect(evaluateVerificationSnapshot(snapshot)).toHaveLength(17);
  });

  it("passes with >= 1 token of votes, self-delegation and the minter role revoked", () => {
    const checks = evaluateVerificationSnapshot({
      ...snapshot,
      initialVotingPower: { votes: ONE * 2n, delegatesSelf: true, deployerHoldsMinter: false }
    });
    expect(checks).toHaveLength(19);
    expect(find(checks, "INITIAL_VOTES_DEPLOYER").passed).toBe(true);
    expect(find(checks, "ROLE_MEMBERSHIP_MINTER_DEPLOYER_REVOKED").passed).toBe(true);
    expect(allVerificationChecksPassed(checks)).toBe(true);
  });

  it.each([
    ["votes below 1 token", { votes: ONE - 1n, delegatesSelf: true, deployerHoldsMinter: false }, "INITIAL_VOTES_DEPLOYER"],
    ["not self-delegated", { votes: ONE, delegatesSelf: false, deployerHoldsMinter: false }, "INITIAL_VOTES_DEPLOYER"],
    ["deployer still minter", { votes: ONE, delegatesSelf: true, deployerHoldsMinter: true }, "ROLE_MEMBERSHIP_MINTER_DEPLOYER_REVOKED"]
  ])("fails with a reason: %s", (_name, initialVotingPower, key) => {
    const checks = evaluateVerificationSnapshot({ ...snapshot, initialVotingPower });
    expect(find(checks, key)).toMatchObject({ passed: false });
    expect(find(checks, key).failureReason).toBeTruthy();
    expect(allVerificationChecksPassed(checks)).toBe(false);
  });

  it("fails both checks with an explicit reason when values are unreadable", () => {
    const checks = evaluateVerificationSnapshot({ ...snapshot, initialVotingPower: {} });
    expect(find(checks, "INITIAL_VOTES_DEPLOYER")).toMatchObject({ passed: false });
    expect(find(checks, "INITIAL_VOTES_DEPLOYER").failureReason).toMatch(/could not be read/i);
    expect(find(checks, "ROLE_MEMBERSHIP_MINTER_DEPLOYER_REVOKED").failureReason).toMatch(/could not be read/i);
  });
});
