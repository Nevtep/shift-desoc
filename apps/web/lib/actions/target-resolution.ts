import type { Address } from "viem";

import { getContractConfig } from "../contracts";
import type { AllowlistTargetId } from "./allowlist";

export type ActionTargetAvailability = {
  targetId: AllowlistTargetId;
  moduleAddress: Address | null;
  allowlistedCount: number;
  enabled: boolean;
  disabledReason: string | null;
};

export type CommunityModuleAddressMap = {
  valuableActionRegistry?: Address;
  verifierElection?: Address;
  verifierManager?: Address;
  verifierPowerToken?: Address;
  revenueRouter?: Address;
  treasuryAdapter?: Address;
  marketplace?: Address;
  paramController?: Address;
  cohortRegistry?: Address;
  investmentCohortManager?: Address;
  positionManager?: Address;
  credentialManager?: Address;
};

const MODULE_KEY_BY_TARGET: Partial<Record<AllowlistTargetId, keyof CommunityModuleAddressMap>> = {
  valuableActionRegistry: "valuableActionRegistry",
  verifierElection: "verifierElection",
  verifierManager: "verifierManager",
  verifierPowerToken: "verifierPowerToken",
  revenueRouter: "revenueRouter",
  treasuryAdapter: "treasuryAdapter",
  marketplace: "marketplace",
  paramController: "paramController",
  cohortRegistry: "cohortRegistry",
  investmentCohortManager: "investmentCohortManager",
  positionManager: "positionManager",
  credentialManager: "credentialManager"
};

export function resolveTargetAddress(
  targetId: AllowlistTargetId,
  chainId: number | undefined,
  moduleAddressMap: CommunityModuleAddressMap
): Address | null {
  if (targetId === "communityRegistry") {
    return getContractConfig("communityRegistry", chainId).address;
  }

  if (targetId === "paramController") {
    return moduleAddressMap.paramController ?? null;
  }

  const moduleKey = MODULE_KEY_BY_TARGET[targetId];
  if (!moduleKey) return null;
  return moduleAddressMap[moduleKey] ?? null;
}

export function buildTargetAvailability(
  targetIds: readonly AllowlistTargetId[],
  chainId: number | undefined,
  moduleAddressMap: CommunityModuleAddressMap,
  getAllowlistedSignatures: (targetId: AllowlistTargetId) => string[]
): ActionTargetAvailability[] {
  return targetIds.map((targetId) => {
    const signatures = getAllowlistedSignatures(targetId);
    const moduleAddress = resolveTargetAddress(targetId, chainId, moduleAddressMap);

    let disabledReason: string | null = null;
    if (!moduleAddress) {
      disabledReason = "Module not configured for this community";
    } else if (signatures.length === 0) {
      disabledReason = "No timelock-allowlisted functions available";
    }

    return {
      targetId,
      moduleAddress,
      allowlistedCount: signatures.length,
      enabled: disabledReason === null,
      disabledReason
    };
  });
}
