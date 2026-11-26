import type { Abi } from "viem";

import bootstrapCoordinatorArtifact from "../../abis/BootstrapCoordinator.json" assert { type: "json" };
import communityRegistryArtifact from "../../abis/CommunityRegistry.json" assert { type: "json" };
import marketplaceArtifact from "../../abis/Marketplace.json" assert { type: "json" };
import membershipTokenArtifact from "../../abis/MembershipTokenERC20Votes.json" assert { type: "json" };
import paramControllerArtifact from "../../abis/ParamController.json" assert { type: "json" };
import revenueRouterArtifact from "../../abis/RevenueRouter.json" assert { type: "json" };
import shiftAccessManagerArtifact from "../../abis/ShiftAccessManager.json" assert { type: "json" };
import treasuryAdapterArtifact from "../../abis/TreasuryAdapter.json" assert { type: "json" };
import valuableActionRegistryArtifact from "../../abis/ValuableActionRegistry.json" assert { type: "json" };
import verifierPowerTokenArtifact from "../../abis/VerifierPowerToken1155.json" assert { type: "json" };

// Single ABI source for the deploy wizard: the artifacts generated from the Solidity
// sources by `pnpm forge:build` (scripts/copy-web-abis.js). Never declare an inline ABI.
export const COMMUNITY_REGISTRY_ABI = communityRegistryArtifact.abi as Abi;
export const MEMBERSHIP_TOKEN_ABI = membershipTokenArtifact.abi as Abi;
export const PARAM_CONTROLLER_ABI = paramControllerArtifact.abi as Abi;
export const SHIFT_ACCESS_MANAGER_ABI = shiftAccessManagerArtifact.abi as Abi;
export const VERIFIER_POWER_TOKEN_ABI = verifierPowerTokenArtifact.abi as Abi;
export const VALUABLE_ACTION_REGISTRY_ABI = valuableActionRegistryArtifact.abi as Abi;
export const REVENUE_ROUTER_ABI = revenueRouterArtifact.abi as Abi;
export const TREASURY_ADAPTER_ABI = treasuryAdapterArtifact.abi as Abi;
export const MARKETPLACE_ABI = marketplaceArtifact.abi as Abi;
export const BOOTSTRAP_COORDINATOR_ABI = bootstrapCoordinatorArtifact.abi as Abi;
// Every AccessManaged module exposes `authority()`; ValuableActionRegistry is the one the wizard probes.
export const ACCESS_MANAGED_AUTHORITY_ABI = valuableActionRegistryArtifact.abi as Abi;

export const COMPILED_ABIS = {
  COMMUNITY_REGISTRY_ABI,
  MEMBERSHIP_TOKEN_ABI,
  PARAM_CONTROLLER_ABI,
  SHIFT_ACCESS_MANAGER_ABI,
  VERIFIER_POWER_TOKEN_ABI,
  VALUABLE_ACTION_REGISTRY_ABI,
  REVENUE_ROUTER_ABI,
  TREASURY_ADAPTER_ABI,
  MARKETPLACE_ABI,
  BOOTSTRAP_COORDINATOR_ABI,
  ACCESS_MANAGED_AUTHORITY_ABI,
} as const;
