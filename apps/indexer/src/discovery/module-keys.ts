import { hexToString, keccak256, toBytes } from "viem";

const ZERO_BYTES32 = "0x".padEnd(66, "0");

export const moduleKeys = {
  ACCESS_MANAGER: "ACCESS_MANAGER",
  MEMBERSHIP_TOKEN: "MEMBERSHIP_TOKEN",
  COUNTING_MULTI_CHOICE: "COUNTING_MULTI_CHOICE",
  REQUEST_HUB: "REQUEST_HUB",
  DRAFTS_MANAGER: "DRAFTS_MANAGER",
  SHIFT_GOVERNOR: "SHIFT_GOVERNOR",
  ENGAGEMENTS: "ENGAGEMENTS",
  VERIFIER_MANAGER: "VERIFIER_MANAGER",
  VALUABLE_ACTION_REGISTRY: "VALUABLE_ACTION_REGISTRY",
  VERIFIER_POWER_TOKEN: "VERIFIER_POWER_TOKEN",
  VERIFIER_ELECTION: "VERIFIER_ELECTION",
  VALUABLE_ACTION_SBT: "VALUABLE_ACTION_SBT",
  REVENUE_ROUTER: "REVENUE_ROUTER",
  TREASURY_ADAPTER: "TREASURY_ADAPTER",
  TREASURY_VAULT: "TREASURY_VAULT",
  PARAM_CONTROLLER: "PARAM_CONTROLLER",
  COHORT_REGISTRY: "COHORT_REGISTRY",
  INVESTMENT_COHORT_MANAGER: "INVESTMENT_COHORT_MANAGER",
  POSITION_MANAGER: "POSITION_MANAGER",
  CREDENTIAL_MANAGER: "CREDENTIAL_MANAGER",
  MARKETPLACE: "MARKETPLACE",
  HOUSING_MANAGER: "HOUSING_MANAGER",
  COMMERCE_DISPUTES: "COMMERCE_DISPUTES",
  PROJECT_FACTORY: "PROJECT_FACTORY",
} as const;

const canonicalByName: Record<string, string> = {
  ACCESS_MANAGER: moduleKeys.ACCESS_MANAGER,
  accessManager: moduleKeys.ACCESS_MANAGER,
  MEMBERSHIP_TOKEN: moduleKeys.MEMBERSHIP_TOKEN,
  membershipToken: moduleKeys.MEMBERSHIP_TOKEN,
  REQUEST_HUB: moduleKeys.REQUEST_HUB,
  requestHub: moduleKeys.REQUEST_HUB,
  DRAFTS_MANAGER: moduleKeys.DRAFTS_MANAGER,
  draftsManager: moduleKeys.DRAFTS_MANAGER,
  SHIFT_GOVERNOR: moduleKeys.SHIFT_GOVERNOR,
  governor: moduleKeys.SHIFT_GOVERNOR,
  COUNTING_MULTI_CHOICE: moduleKeys.COUNTING_MULTI_CHOICE,
  countingMultiChoice: moduleKeys.COUNTING_MULTI_CHOICE,
  ENGAGEMENTS: moduleKeys.ENGAGEMENTS,
  engagementsManager: moduleKeys.ENGAGEMENTS,
  VERIFIER_MANAGER: moduleKeys.VERIFIER_MANAGER,
  verifierManager: moduleKeys.VERIFIER_MANAGER,
  VALUABLE_ACTION_REGISTRY: moduleKeys.VALUABLE_ACTION_REGISTRY,
  valuableActionRegistry: moduleKeys.VALUABLE_ACTION_REGISTRY,
  VERIFIER_POWER_TOKEN: moduleKeys.VERIFIER_POWER_TOKEN,
  verifierPowerToken: moduleKeys.VERIFIER_POWER_TOKEN,
  VERIFIER_ELECTION: moduleKeys.VERIFIER_ELECTION,
  verifierElection: moduleKeys.VERIFIER_ELECTION,
  VALUABLE_ACTION_SBT: moduleKeys.VALUABLE_ACTION_SBT,
  valuableActionSBT: moduleKeys.VALUABLE_ACTION_SBT,
  REVENUE_ROUTER: moduleKeys.REVENUE_ROUTER,
  revenueRouter: moduleKeys.REVENUE_ROUTER,
  TREASURY_ADAPTER: moduleKeys.TREASURY_ADAPTER,
  treasuryAdapter: moduleKeys.TREASURY_ADAPTER,
  TREASURY_VAULT: moduleKeys.TREASURY_VAULT,
  treasuryVault: moduleKeys.TREASURY_VAULT,
  PARAM_CONTROLLER: moduleKeys.PARAM_CONTROLLER,
  paramController: moduleKeys.PARAM_CONTROLLER,
  COHORT_REGISTRY: moduleKeys.COHORT_REGISTRY,
  cohortRegistry: moduleKeys.COHORT_REGISTRY,
  INVESTMENT_COHORT_MANAGER: moduleKeys.INVESTMENT_COHORT_MANAGER,
  investmentCohortManager: moduleKeys.INVESTMENT_COHORT_MANAGER,
  POSITION_MANAGER: moduleKeys.POSITION_MANAGER,
  positionManager: moduleKeys.POSITION_MANAGER,
  CREDENTIAL_MANAGER: moduleKeys.CREDENTIAL_MANAGER,
  credentialManager: moduleKeys.CREDENTIAL_MANAGER,
  MARKETPLACE: moduleKeys.MARKETPLACE,
  marketplace: moduleKeys.MARKETPLACE,
  HOUSING_MANAGER: moduleKeys.HOUSING_MANAGER,
  housingManager: moduleKeys.HOUSING_MANAGER,
  COMMERCE_DISPUTES: moduleKeys.COMMERCE_DISPUTES,
  commerceDisputes: moduleKeys.COMMERCE_DISPUTES,
  PROJECT_FACTORY: moduleKeys.PROJECT_FACTORY,
  projectFactory: moduleKeys.PROJECT_FACTORY,
};

const knownHexKeyMap: Record<string, string> = {
  [keccak256(toBytes("accessManager")).toLowerCase()]: moduleKeys.ACCESS_MANAGER,
  [keccak256(toBytes("membershipToken")).toLowerCase()]: moduleKeys.MEMBERSHIP_TOKEN,
  [keccak256(toBytes("requestHub")).toLowerCase()]: moduleKeys.REQUEST_HUB,
  [keccak256(toBytes("draftsManager")).toLowerCase()]: moduleKeys.DRAFTS_MANAGER,
  [keccak256(toBytes("governor")).toLowerCase()]: moduleKeys.SHIFT_GOVERNOR,
  [keccak256(toBytes("countingMultiChoice")).toLowerCase()]: moduleKeys.COUNTING_MULTI_CHOICE,
  [keccak256(toBytes("engagementsManager")).toLowerCase()]: moduleKeys.ENGAGEMENTS,
  [keccak256(toBytes("verifierPowerToken")).toLowerCase()]: moduleKeys.VERIFIER_POWER_TOKEN,
  [keccak256(toBytes("verifierElection")).toLowerCase()]: moduleKeys.VERIFIER_ELECTION,
  [keccak256(toBytes("verifierManager")).toLowerCase()]: moduleKeys.VERIFIER_MANAGER,
  [keccak256(toBytes("valuableActionRegistry")).toLowerCase()]: moduleKeys.VALUABLE_ACTION_REGISTRY,
  [keccak256(toBytes("valuableActionSBT")).toLowerCase()]: moduleKeys.VALUABLE_ACTION_SBT,
  [keccak256(toBytes("revenueRouter")).toLowerCase()]: moduleKeys.REVENUE_ROUTER,
  [keccak256(toBytes("treasuryVault")).toLowerCase()]: moduleKeys.TREASURY_VAULT,
  [keccak256(toBytes("treasuryAdapter")).toLowerCase()]: moduleKeys.TREASURY_ADAPTER,
  [keccak256(toBytes("paramController")).toLowerCase()]: moduleKeys.PARAM_CONTROLLER,
  [keccak256(toBytes("cohortRegistry")).toLowerCase()]: moduleKeys.COHORT_REGISTRY,
  [keccak256(toBytes("investmentCohortManager")).toLowerCase()]: moduleKeys.INVESTMENT_COHORT_MANAGER,
  [keccak256(toBytes("positionManager")).toLowerCase()]: moduleKeys.POSITION_MANAGER,
  [keccak256(toBytes("credentialManager")).toLowerCase()]: moduleKeys.CREDENTIAL_MANAGER,
  [keccak256(toBytes("marketplace")).toLowerCase()]: moduleKeys.MARKETPLACE,
  [keccak256(toBytes("housingManager")).toLowerCase()]: moduleKeys.HOUSING_MANAGER,
  [keccak256(toBytes("commerceDisputes")).toLowerCase()]: moduleKeys.COMMERCE_DISPUTES,
  [keccak256(toBytes("projectFactory")).toLowerCase()]: moduleKeys.PROJECT_FACTORY,
};

export const normalizeModuleKey = (value: string): string => {
  if (!value) return "UNKNOWN";
  const direct = canonicalByName[value] ?? canonicalByName[value.toUpperCase()];
  if (direct) return direct;

  const lower = value.toLowerCase();
  if (lower === ZERO_BYTES32) return "UNKNOWN";

  if (knownHexKeyMap[lower]) {
    return knownHexKeyMap[lower]!;
  }

  try {
    const decoded = hexToString(value as `0x${string}`, { size: 32 }).replace(/\u0000/g, "").trim();
    if (decoded.length > 0) {
      const canonical = canonicalByName[decoded] ?? canonicalByName[decoded.toUpperCase()];
      if (canonical) return canonical;

      if (/^[A-Za-z0-9_]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch {
    // Keep raw key fallback below when bytes32 decoding is not UTF-8 friendly.
  }

  return lower;
};

export type ModuleKey = (typeof moduleKeys)[keyof typeof moduleKeys] | string;
