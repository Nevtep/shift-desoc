import type { Address } from "viem";

import type { CommunityModules } from "../../hooks/useCommunityModules";

// Mirrors CHECKS in apps/web/scripts/verify-access-wiring.mjs (parity enforced by unit test).
const VPT_ELECTION_POWER_ROLE = 1001;
const VERIFIER_MANAGER_CALLER_ROLE = 15;
const COHORT_REVENUE_ROUTER_ROLE = 1;
const COHORT_INVESTMENT_RECORDER_ROLE = 2;
const REVENUE_ROUTER_POSITION_MANAGER_ROLE = 7;
const REVENUE_ROUTER_DISTRIBUTOR_ROLE = 6;
const VALUABLE_ACTION_REGISTRY_ISSUER_ROLE = 3;
const VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE = 17;
const MEMBERSHIP_TOKEN_MINTER_ROLE = 11;
const MEMBERSHIP_TOKEN_GOVERNANCE_ROLE = 12;
const VALUABLE_ACTION_SBT_MANAGER_ROLE = 4;
const COMMERCE_DISPUTES_CALLER_ROLE = 13;
const HOUSING_MARKETPLACE_CALLER_ROLE = 14;
const CREDENTIAL_MANAGER_APPROVER_ROLE = 16;

export type AccessCheckRole = "ADMIN" | number;

export type AccessWiringCheck = {
  targetKey: string;
  signature: string;
  role: AccessCheckRole;
};

export const ACCESS_WIRING_CHECKS: AccessWiringCheck[] = [
  { targetKey: "valuableActionRegistry", signature: "setValuableActionSBT(address)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setIssuancePaused(bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setIssuanceModule(address,bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setCommunityNarrowing(bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setCommunityIssuanceModule(address,bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "addFounder(address)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "proposeValuableAction((uint32,uint32,uint32,uint8,bytes32,uint32,uint8,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64),bytes32)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "activateFromGovernance(uint256,bytes32)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "update(uint256,(uint32,uint32,uint32,uint8,bytes32,uint32,uint8,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64))", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "deactivate(uint256)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setModerator(address,bool)", role: VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueEngagement(address,uint8,bytes32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issuePosition(address,bytes32,uint32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueInvestment(address,uint256,uint32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "closePositionToken(uint256,uint8)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "engagements", signature: "revoke(uint256)", role: "ADMIN" },
  { targetKey: "engagements", signature: "updateContracts(address,address)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "setVerifierSet(address[],uint256[],string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "banVerifiers(address[],string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "unbanVerifier(address,string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "adjustVerifierPower(address,uint256,string)", role: "ADMIN" },
  { targetKey: "verifierManager", signature: "selectJurors(uint256,uint256,uint256,bool)", role: VERIFIER_MANAGER_CALLER_ROLE },
  { targetKey: "verifierManager", signature: "reportFraud(uint256,address[],string)", role: VERIFIER_MANAGER_CALLER_ROLE },
  { targetKey: "verifierPowerToken", signature: "initializeCommunity(string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "adminTransfer(address,address,uint256,string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "setURI(string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "mint(address,uint256,string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "burn(address,uint256,string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "batchMint(address[],uint256[],string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "batchBurn(address[],uint256[],string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "positionManager", signature: "setRevenueRouter(address)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "definePositionType(bytes32,uint32,bool)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "approveApplication(uint256,bytes)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "closePosition(uint256,uint8,bytes)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "defineCourse(bytes32,address,bool)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "setCourseActive(bytes32,bool)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "revokeCredential(uint256,bytes32,bytes)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "approveApplication(uint256)", role: CREDENTIAL_MANAGER_APPROVER_ROLE },
  { targetKey: "cohortRegistry", signature: "createCohort(uint16,uint32,bytes32,uint64,uint64,bool)", role: "ADMIN" },
  { targetKey: "cohortRegistry", signature: "setCohortActive(uint256,bool)", role: "ADMIN" },
  { targetKey: "cohortRegistry", signature: "markRecovered(uint256,uint256)", role: COHORT_REVENUE_ROUTER_ROLE },
  { targetKey: "cohortRegistry", signature: "addInvestment(uint256,address,uint256,uint256)", role: COHORT_INVESTMENT_RECORDER_ROLE },
  { targetKey: "investmentCohortManager", signature: "createCohort(uint16,uint32,bytes32,uint64,uint64,bool)", role: "ADMIN" },
  { targetKey: "investmentCohortManager", signature: "setCohortActive(uint256,bool)", role: "ADMIN" },
  { targetKey: "investmentCohortManager", signature: "issueInvestment(address,uint256,uint32,bytes)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setCommunityTreasury(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setSupportedToken(address,bool)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setParamController(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setCohortRegistry(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "registerPosition(uint256)", role: REVENUE_ROUTER_POSITION_MANAGER_ROLE },
  { targetKey: "revenueRouter", signature: "unregisterPosition(uint256)", role: REVENUE_ROUTER_POSITION_MANAGER_ROLE },
  { targetKey: "revenueRouter", signature: "routeRevenue(address,uint256)", role: REVENUE_ROUTER_DISTRIBUTOR_ROLE },
  { targetKey: "treasuryAdapter", signature: "setTokenAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setDestinationAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setVaultAdapterAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setCapBps(address,uint16)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setCommunityActive(bool)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setCommunityToken(address)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setCommerceDisputes(address)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setRevenueRouter(address)", role: "ADMIN" },
  { targetKey: "membershipToken", signature: "mint(address,uint256,string)", role: MEMBERSHIP_TOKEN_MINTER_ROLE },
  { targetKey: "membershipToken", signature: "batchMint(address[],uint256[],string)", role: MEMBERSHIP_TOKEN_MINTER_ROLE },
  { targetKey: "membershipToken", signature: "emergencyBurn(address,uint256)", role: MEMBERSHIP_TOKEN_GOVERNANCE_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintEngagement(address,uint8,bytes32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintPosition(address,bytes32,uint32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintInvestment(address,uint256,uint32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "setEndedAt(uint256,uint64)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "closePositionToken(uint256,uint8)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "updateTokenURI(uint256,string)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "commerceDisputes", signature: "setDisputeReceiver(address)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "finalizeDispute(uint256,uint8)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "cancelDispute(uint256)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "openDispute(uint8,uint256,address,address,uint256,string)", role: COMMERCE_DISPUTES_CALLER_ROLE },
  { targetKey: "housingManager", signature: "createUnit(address,string,uint256,uint256,uint256)", role: "ADMIN" },
  { targetKey: "housingManager", signature: "consume(uint256,address,bytes,uint256)", role: HOUSING_MARKETPLACE_CALLER_ROLE },
  { targetKey: "housingManager", signature: "onOrderSettled(uint256,uint256,uint8)", role: HOUSING_MARKETPLACE_CALLER_ROLE }
];

// Script target keys that differ from CommunityModules keys.
const MODULE_KEY_BY_TARGET: Record<string, keyof CommunityModules> = { engagements: "engagementsManager" };

export function moduleKeyForTarget(targetKey: string): keyof CommunityModules {
  return MODULE_KEY_BY_TARGET[targetKey] ?? (targetKey as keyof CommunityModules);
}

export type AccessSignal = "pass" | "fail" | "unavailable";

/** Raw on-chain reads; null means the read failed or was not performed (fail closed). */
export type AccessReadResults = {
  adminRole: bigint | null;
  /** index in ACCESS_WIRING_CHECKS -> role bound to the selector */
  functionRoles: Record<number, bigint | null>;
  /** role id (decimal string) -> whether the timelock holds it */
  timelockHasRole: Record<string, boolean | null>;
};

export type AccessInspectionRow = {
  targetKey: string;
  target: Address | null;
  signature: string;
  expectedRole: string | null;
  actualRole: string | null;
  status: AccessSignal;
};

export type AccessInspection = {
  overall: AccessSignal;
  timelockAdmin: AccessSignal;
  rows: AccessInspectionRow[];
};

function rollUp(signals: AccessSignal[]): AccessSignal {
  if (signals.includes("fail")) return "fail";
  if (signals.length === 0 || signals.includes("unavailable")) return "unavailable";
  return "pass";
}

export function evaluateAccessInspection(
  modules: CommunityModules | null,
  reads: AccessReadResults | null
): AccessInspection {
  const adminRole = reads?.adminRole ?? null;
  const adminKey = adminRole === null ? null : adminRole.toString();
  const adminHeld = adminKey === null ? null : (reads?.timelockHasRole[adminKey] ?? null);
  const timelockAdmin: AccessSignal = adminHeld === null ? "unavailable" : adminHeld ? "pass" : "fail";

  const rows = ACCESS_WIRING_CHECKS.map((check, index): AccessInspectionRow => {
    const target = (modules?.[moduleKeyForTarget(check.targetKey)] as Address | undefined) ?? null;
    const expected = check.role === "ADMIN" ? adminRole : BigInt(check.role);
    const actual = reads?.functionRoles[index] ?? null;
    const base = {
      targetKey: check.targetKey,
      target,
      signature: check.signature,
      expectedRole: expected === null ? null : expected.toString(),
      actualRole: actual === null ? null : actual.toString()
    };
    if (!target || !modules?.accessManager || expected === null || actual === null) {
      return { ...base, status: "unavailable" };
    }
    if (actual !== expected) return { ...base, status: "fail" };
    if (check.role === "ADMIN") {
      // Same rule as verify-access-wiring.mjs: ADMIN-gated selectors also require the timelock to hold ADMIN.
      if (adminHeld === null) return { ...base, status: "unavailable" };
      return { ...base, status: adminHeld ? "pass" : "fail" };
    }
    return { ...base, status: "pass" };
  });

  return {
    overall: rollUp([timelockAdmin, ...rows.map((r) => r.status)]),
    timelockAdmin,
    rows
  };
}
