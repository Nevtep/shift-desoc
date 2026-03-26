import type { Abi, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import accessManagerArtifact from "../../abis/ShiftAccessManager.json" assert { type: "json" };
import communityRegistryArtifact from "../../abis/CommunityRegistry.json" assert { type: "json" };
import marketplaceArtifact from "../../abis/Marketplace.json" assert { type: "json" };
import revenueRouterArtifact from "../../abis/RevenueRouter.json" assert { type: "json" };
import verifierPowerTokenArtifact from "../../abis/VerifierPowerToken1155.json" assert { type: "json" };
import type { DeploymentRunAddresses, VerificationSnapshot } from "./types";

const communityRegistryAbi = communityRegistryArtifact.abi as Abi;
const accessManagerAbi = accessManagerArtifact.abi as Abi;
const verifierPowerTokenAbi = verifierPowerTokenArtifact.abi as Abi;
const marketplaceAbi = marketplaceArtifact.abi as Abi;
const revenueRouterAbi = revenueRouterArtifact.abi as Abi;

const ACCESS_MANAGED_AUTHORITY_ABI = [
  {
    type: "function",
    name: "authority",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const satisfies Abi;

const ROLES = {
  COHORT_REVENUE_ROUTER_ROLE: 1n,
  COHORT_INVESTMENT_RECORDER_ROLE: 2n,
  VALUABLE_ACTION_REGISTRY_ISSUER_ROLE: 3n,
  VALUABLE_ACTION_SBT_MANAGER_ROLE: 4n,
  MEMBERSHIP_TOKEN_MINTER_ROLE: 11n,
  REVENUE_ROUTER_DISTRIBUTOR_ROLE: 6n,
  REVENUE_ROUTER_POSITION_MANAGER_ROLE: 7n,
  COMMERCE_DISPUTES_CALLER_ROLE: 13n,
  HOUSING_MARKETPLACE_CALLER_ROLE: 14n,
  VERIFIER_MANAGER_CALLER_ROLE: 15n
};

export async function readVerificationSnapshot(
  publicClient: PublicClient,
  chainId: number,
  communityId: number,
  deploymentAddresses?: DeploymentRunAddresses
): Promise<VerificationSnapshot> {
  const communityRegistry = getContractAddress("communityRegistry", chainId);
  const modules = (await publicClient.readContract({
    address: communityRegistry,
    abi: communityRegistryAbi,
    functionName: "getCommunityModules",
    args: [BigInt(communityId)]
  })) as {
    requestHub: `0x${string}`;
    valuableActionRegistry: `0x${string}`;
    verifierPowerToken: `0x${string}`;
  };

  const requestHub = modules.requestHub;
  const valuableActionRegistry = modules.valuableActionRegistry;
  const verifierPowerToken = modules.verifierPowerToken;

  const accessManager = (deploymentAddresses?.accessManager ??
    ((await publicClient.readContract({
      address: valuableActionRegistry,
      abi: ACCESS_MANAGED_AUTHORITY_ABI,
      functionName: "authority"
    })) as `0x${string}`)) as `0x${string}`;

  const marketplace = deploymentAddresses?.marketplace as `0x${string}` | undefined;
  if (!marketplace) {
    throw new Error(
      "Missing marketplace address in deployment run state. Wizard verification now uses run-scoped community module addresses, not NEXT_PUBLIC_MARKETPLACE."
    );
  }

  const positionManager = deploymentAddresses?.positionManager as `0x${string}` | undefined;
  if (!positionManager) {
    throw new Error(
      "Missing positionManager address in deployment run state. Wizard verification now uses run-scoped community module addresses, not NEXT_PUBLIC_POSITION_MANAGER."
    );
  }

  const engagements = deploymentAddresses?.engagements as `0x${string}` | undefined;
  if (!engagements) {
    throw new Error(
      "Missing engagements address in deployment run state. Wizard verification now uses run-scoped community module addresses."
    );
  }

  const credentialManager = deploymentAddresses?.credentialManager as `0x${string}` | undefined;
  if (!credentialManager) {
    throw new Error(
      "Missing credentialManager address in deployment run state. Wizard verification now uses run-scoped community module addresses."
    );
  }

  const investmentCohortManager = deploymentAddresses?.investmentCohortManager as `0x${string}` | undefined;
  if (!investmentCohortManager) {
    throw new Error(
      "Missing investmentCohortManager address in deployment run state. Wizard verification now uses run-scoped community module addresses."
    );
  }

  const revenueRouter = (await publicClient.readContract({
    address: marketplace,
    abi: marketplaceAbi,
    functionName: "revenueRouter"
  })) as `0x${string}`;

  const vptInitializedRaw = await publicClient.readContract({
    address: verifierPowerToken,
    abi: verifierPowerTokenAbi,
    functionName: "communityInitialized"
  });

  const [
    rrPosRoleRaw,
    rrDistributorRaw,
    disputesCallerRaw,
    housingCallerRaw,
    vaIssuerRequestHubRaw,
    vaIssuerPositionManagerRaw,
    vaIssuerInvestmentCohortManagerRaw,
    vaIssuerCredentialManagerRaw,
    verifierManagerCallerRaw,
    cohortRevenueRouterRaw,
    cohortInvestmentRecorderRaw,
    membershipMinterRaw,
    valuableActionSbtManagerRaw,
    communityActiveRaw,
    treasuryRaw
  ] =
    await Promise.all([
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE, positionManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.REVENUE_ROUTER_DISTRIBUTOR_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.COMMERCE_DISPUTES_CALLER_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.HOUSING_MARKETPLACE_CALLER_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, requestHub]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, positionManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, investmentCohortManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, credentialManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VERIFIER_MANAGER_CALLER_ROLE, engagements]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.COHORT_REVENUE_ROUTER_ROLE, revenueRouter]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.COHORT_INVESTMENT_RECORDER_ROLE, investmentCohortManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.MEMBERSHIP_TOKEN_MINTER_ROLE, engagements]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: accessManagerAbi,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE, valuableActionRegistry]
      }),
      publicClient.readContract({
        address: marketplace,
        abi: marketplaceAbi,
        functionName: "communityActive"
      }),
      publicClient.readContract({
        address: revenueRouter,
        abi: revenueRouterAbi,
        functionName: "communityTreasuries"
      })
    ]);

  const pickBool = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (Array.isArray(value) && typeof value[0] === "boolean") return value[0];
    return false;
  };

  const vptInitialized = pickBool(vptInitializedRaw);
  const rrPosRole = pickBool(rrPosRoleRaw);
  const verifierManagerCallerEngagements = pickBool(verifierManagerCallerRaw);
  const rrDistributor = pickBool(rrDistributorRaw);
  const disputesCaller = pickBool(disputesCallerRaw);
  const cohortRevenueRouter = pickBool(cohortRevenueRouterRaw);
  const housingCaller = pickBool(housingCallerRaw);
  const cohortInvestmentRecorder = pickBool(cohortInvestmentRecorderRaw);
  const vaIssuerRequestHub = pickBool(vaIssuerRequestHubRaw);
  const vaIssuerPositionManager = pickBool(vaIssuerPositionManagerRaw);
  const vaIssuerInvestmentCohortManager = pickBool(vaIssuerInvestmentCohortManagerRaw);
  const vaIssuerCredentialManager = pickBool(vaIssuerCredentialManagerRaw);
  const membershipMinterEngagements = pickBool(membershipMinterRaw);
  const vaSbtManagerRegistry = pickBool(valuableActionSbtManagerRaw);
  const communityActive = pickBool(communityActiveRaw);
  const treasury = typeof treasuryRaw === "string" ? treasuryRaw : "0x0000000000000000000000000000000000000000";

  return {
    communityId,
    modules: {
      valuableActionRegistryMatches:
        valuableActionRegistry.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    },
    vptInitialized,
    roles: {
      rrPositionManager: rrPosRole,
      verifierManagerCallerEngagements,
      rrDistributor: rrDistributor,
      commerceDisputesCaller: disputesCaller,
      cohortRevenueRouter,
      housingMarketplaceCaller: housingCaller,
      cohortInvestmentRecorder,
      vaIssuerRequestHub,
      vaIssuerPositionManager,
      vaIssuerInvestmentCohortManager,
      vaIssuerCredentialManager,
      membershipMinterEngagements,
      vaSbtManagerRegistry
    },
    marketplaceActive: communityActive,
    revenueTreasurySet: treasury.toLowerCase() !== "0x0000000000000000000000000000000000000000"
  };
}
