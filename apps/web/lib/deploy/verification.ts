import type { VerificationCheckResult, VerificationCheckKey, VerificationSnapshot } from "./types";

const CHECK_LABELS: Record<VerificationCheckKey, string> = {
  MODULE_WIRING_VALUABLE_ACTION_REGISTRY: "CommunityRegistry valuableActionRegistry module wiring",
  VPT_COMMUNITY_INITIALIZED: "VerifierPowerToken community initialized",
  ROLE_RR_POSITION_MANAGER: "PositionManager has REVENUE_ROUTER_POSITION_MANAGER_ROLE",
  ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS: "Engagements has VERIFIER_MANAGER_CALLER_ROLE",
  ROLE_RR_DISTRIBUTOR: "Marketplace has REVENUE_ROUTER_DISTRIBUTOR_ROLE",
  ROLE_COMMERCE_DISPUTES_CALLER: "Marketplace has COMMERCE_DISPUTES_CALLER_ROLE",
  ROLE_COHORT_REVENUE_ROUTER: "RevenueRouter has COHORT_REVENUE_ROUTER_ROLE",
  ROLE_HOUSING_MARKETPLACE_CALLER: "Marketplace has HOUSING_MARKETPLACE_CALLER_ROLE",
  ROLE_COHORT_INVESTMENT_RECORDER: "InvestmentCohortManager has COHORT_INVESTMENT_RECORDER_ROLE",
  ROLE_VA_ISSUER_REQUEST_HUB: "RequestHub has VALUABLE_ACTION_REGISTRY_ISSUER_ROLE",
  ROLE_VA_ISSUER_POSITION_MANAGER: "PositionManager has VALUABLE_ACTION_REGISTRY_ISSUER_ROLE",
  ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER:
    "InvestmentCohortManager has VALUABLE_ACTION_REGISTRY_ISSUER_ROLE",
  ROLE_VA_ISSUER_CREDENTIAL_MANAGER: "CredentialManager has VALUABLE_ACTION_REGISTRY_ISSUER_ROLE",
  ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS: "Engagements has MEMBERSHIP_TOKEN_MINTER_ROLE",
  ROLE_VA_SBT_MANAGER_REGISTRY: "ValuableActionRegistry has VALUABLE_ACTION_SBT_MANAGER_ROLE",
  MARKETPLACE_COMMUNITY_ACTIVE: "Marketplace community is active",
  REVENUE_ROUTER_TREASURY_SET: "RevenueRouter treasury is configured"
};

export function evaluateVerificationSnapshot(snapshot: VerificationSnapshot): VerificationCheckResult[] {
  // Mirror the check set and semantics defined in verify-community-deployment.ts.
  return [
    {
      key: "MODULE_WIRING_VALUABLE_ACTION_REGISTRY",
      label: CHECK_LABELS.MODULE_WIRING_VALUABLE_ACTION_REGISTRY,
      passed: snapshot.modules.valuableActionRegistryMatches,
      failureReason: snapshot.modules.valuableActionRegistryMatches
        ? undefined
        : "CommunityRegistry module wiring mismatch for ValuableActionRegistry"
    },
    {
      key: "VPT_COMMUNITY_INITIALIZED",
      label: CHECK_LABELS.VPT_COMMUNITY_INITIALIZED,
      passed: snapshot.vptInitialized,
      failureReason: snapshot.vptInitialized ? undefined : "VerifierPowerToken community is not initialized"
    },
    {
      key: "ROLE_RR_POSITION_MANAGER",
      label: CHECK_LABELS.ROLE_RR_POSITION_MANAGER,
      passed: snapshot.roles.rrPositionManager,
      failureReason: snapshot.roles.rrPositionManager
        ? undefined
        : "PositionManager missing REVENUE_ROUTER_POSITION_MANAGER_ROLE"
    },
    {
      key: "ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS",
      label: CHECK_LABELS.ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS,
      passed: snapshot.roles.verifierManagerCallerEngagements,
      failureReason: snapshot.roles.verifierManagerCallerEngagements
        ? undefined
        : "Engagements missing VERIFIER_MANAGER_CALLER_ROLE"
    },
    {
      key: "ROLE_RR_DISTRIBUTOR",
      label: CHECK_LABELS.ROLE_RR_DISTRIBUTOR,
      passed: snapshot.roles.rrDistributor,
      failureReason: snapshot.roles.rrDistributor
        ? undefined
        : "Marketplace missing REVENUE_ROUTER_DISTRIBUTOR_ROLE"
    },
    {
      key: "ROLE_COMMERCE_DISPUTES_CALLER",
      label: CHECK_LABELS.ROLE_COMMERCE_DISPUTES_CALLER,
      passed: snapshot.roles.commerceDisputesCaller,
      failureReason: snapshot.roles.commerceDisputesCaller
        ? undefined
        : "Marketplace missing COMMERCE_DISPUTES_CALLER_ROLE"
    },
    {
      key: "ROLE_COHORT_REVENUE_ROUTER",
      label: CHECK_LABELS.ROLE_COHORT_REVENUE_ROUTER,
      passed: snapshot.roles.cohortRevenueRouter,
      failureReason: snapshot.roles.cohortRevenueRouter
        ? undefined
        : "RevenueRouter missing COHORT_REVENUE_ROUTER_ROLE"
    },
    {
      key: "ROLE_HOUSING_MARKETPLACE_CALLER",
      label: CHECK_LABELS.ROLE_HOUSING_MARKETPLACE_CALLER,
      passed: snapshot.roles.housingMarketplaceCaller,
      failureReason: snapshot.roles.housingMarketplaceCaller
        ? undefined
        : "Marketplace missing HOUSING_MARKETPLACE_CALLER_ROLE"
    },
    {
      key: "ROLE_COHORT_INVESTMENT_RECORDER",
      label: CHECK_LABELS.ROLE_COHORT_INVESTMENT_RECORDER,
      passed: snapshot.roles.cohortInvestmentRecorder,
      failureReason: snapshot.roles.cohortInvestmentRecorder
        ? undefined
        : "InvestmentCohortManager missing COHORT_INVESTMENT_RECORDER_ROLE"
    },
    {
      key: "ROLE_VA_ISSUER_REQUEST_HUB",
      label: CHECK_LABELS.ROLE_VA_ISSUER_REQUEST_HUB,
      passed: snapshot.roles.vaIssuerRequestHub,
      failureReason: snapshot.roles.vaIssuerRequestHub
        ? undefined
        : "RequestHub missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE"
    },
    {
      key: "ROLE_VA_ISSUER_POSITION_MANAGER",
      label: CHECK_LABELS.ROLE_VA_ISSUER_POSITION_MANAGER,
      passed: snapshot.roles.vaIssuerPositionManager,
      failureReason: snapshot.roles.vaIssuerPositionManager
        ? undefined
        : "PositionManager missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE"
    },
    {
      key: "ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER",
      label: CHECK_LABELS.ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER,
      passed: snapshot.roles.vaIssuerInvestmentCohortManager,
      failureReason: snapshot.roles.vaIssuerInvestmentCohortManager
        ? undefined
        : "InvestmentCohortManager missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE"
    },
    {
      key: "ROLE_VA_ISSUER_CREDENTIAL_MANAGER",
      label: CHECK_LABELS.ROLE_VA_ISSUER_CREDENTIAL_MANAGER,
      passed: snapshot.roles.vaIssuerCredentialManager,
      failureReason: snapshot.roles.vaIssuerCredentialManager
        ? undefined
        : "CredentialManager missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE"
    },
    {
      key: "ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS",
      label: CHECK_LABELS.ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS,
      passed: snapshot.roles.membershipMinterEngagements,
      failureReason: snapshot.roles.membershipMinterEngagements
        ? undefined
        : "Engagements missing MEMBERSHIP_TOKEN_MINTER_ROLE"
    },
    {
      key: "ROLE_VA_SBT_MANAGER_REGISTRY",
      label: CHECK_LABELS.ROLE_VA_SBT_MANAGER_REGISTRY,
      passed: snapshot.roles.vaSbtManagerRegistry,
      failureReason: snapshot.roles.vaSbtManagerRegistry
        ? undefined
        : "ValuableActionRegistry missing VALUABLE_ACTION_SBT_MANAGER_ROLE"
    },
    {
      key: "MARKETPLACE_COMMUNITY_ACTIVE",
      label: CHECK_LABELS.MARKETPLACE_COMMUNITY_ACTIVE,
      passed: snapshot.marketplaceActive,
      failureReason: snapshot.marketplaceActive ? undefined : "Marketplace not activated for community"
    },
    {
      key: "REVENUE_ROUTER_TREASURY_SET",
      label: CHECK_LABELS.REVENUE_ROUTER_TREASURY_SET,
      passed: snapshot.revenueTreasurySet,
      failureReason: snapshot.revenueTreasurySet ? undefined : "RevenueRouter treasury is not set"
    }
  ];
}

export function allVerificationChecksPassed(results: VerificationCheckResult[]): boolean {
  return results.length > 0 && results.every((result) => result.passed);
}
