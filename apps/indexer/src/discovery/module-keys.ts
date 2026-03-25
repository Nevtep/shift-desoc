import { hexToString } from "viem";

const ZERO_BYTES32 = "0x".padEnd(66, "0");

const knownHexKeyMap: Record<string, string> = {};

export const normalizeModuleKey = (value: string): string => {
  if (!value) return "UNKNOWN";
  const lower = value.toLowerCase();
  if (lower === ZERO_BYTES32) return "UNKNOWN";

  if (knownHexKeyMap[lower]) {
    return knownHexKeyMap[lower]!;
  }

  try {
    const decoded = hexToString(value as `0x${string}`, { size: 32 }).replace(/\u0000/g, "").trim();
    if (decoded.length > 0) {
      return decoded;
    }
  } catch {
    // Keep raw key fallback below when bytes32 decoding is not UTF-8 friendly.
  }

  return lower;
};

export const moduleKeys = {
  REQUEST_HUB: "REQUEST_HUB",
  DRAFTS_MANAGER: "DRAFTS_MANAGER",
  SHIFT_GOVERNOR: "SHIFT_GOVERNOR",
  COUNTING_MULTI_CHOICE: "COUNTING_MULTI_CHOICE",
  ENGAGEMENTS: "ENGAGEMENTS",
  VERIFIER_MANAGER: "VERIFIER_MANAGER",
  VALUABLE_ACTION_REGISTRY: "VALUABLE_ACTION_REGISTRY",
  REVENUE_ROUTER: "REVENUE_ROUTER",
  TREASURY_ADAPTER: "TREASURY_ADAPTER",
  COHORT_REGISTRY: "COHORT_REGISTRY",
  INVESTMENT_COHORT_MANAGER: "INVESTMENT_COHORT_MANAGER",
  POSITION_MANAGER: "POSITION_MANAGER",
  CREDENTIAL_MANAGER: "CREDENTIAL_MANAGER",
  MARKETPLACE: "MARKETPLACE",
  HOUSING_MANAGER: "HOUSING_MANAGER",
  COMMERCE_DISPUTES: "COMMERCE_DISPUTES",
  PROJECT_FACTORY: "PROJECT_FACTORY",
} as const;

export type ModuleKey = (typeof moduleKeys)[keyof typeof moduleKeys] | string;
