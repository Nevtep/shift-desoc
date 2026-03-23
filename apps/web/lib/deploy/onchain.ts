import type { Abi, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import type { DeploymentRunAddresses, VerificationSnapshot } from "./types";

const COMMUNITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "getCommunityModules",
    stateMutability: "view",
    inputs: [{ name: "communityId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "governor", type: "address" },
          { name: "timelock", type: "address" },
          { name: "requestHub", type: "address" },
          { name: "draftsManager", type: "address" },
          { name: "engagementsManager", type: "address" },
          { name: "valuableActionRegistry", type: "address" },
          { name: "verifierPowerToken", type: "address" },
          { name: "verifierElection", type: "address" },
          { name: "verifierManager", type: "address" },
          { name: "valuableActionSBT", type: "address" },
          { name: "treasuryVault", type: "address" },
          { name: "treasuryAdapter", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "paramController", type: "address" }
        ]
      }
    ]
  }
] as const satisfies Abi;

const ACCESS_MANAGER_ABI = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "roleId", type: "uint64" },
      { name: "account", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const satisfies Abi;

const VPT_ABI_BY_COMMUNITY = [
  {
    type: "function",
    name: "communityInitialized",
    stateMutability: "view",
    inputs: [{ name: "communityId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  }
] as const satisfies Abi;

const VPT_ABI_GLOBAL = [
  {
    type: "function",
    name: "communityInitialized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  }
] as const satisfies Abi;

const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "communityActive",
    stateMutability: "view",
    inputs: [{ name: "communityId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "revenueRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const satisfies Abi;

const ACCESS_MANAGED_AUTHORITY_ABI = [
  {
    type: "function",
    name: "authority",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const satisfies Abi;

const REVENUE_ROUTER_ABI = [
  {
    type: "function",
    name: "communityTreasuries",
    stateMutability: "view",
    inputs: [{ name: "communityId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  }
] as const satisfies Abi;

const ROLES = {
  VALUABLE_ACTION_REGISTRY_ISSUER_ROLE: 3n,
  REVENUE_ROUTER_DISTRIBUTOR_ROLE: 6n,
  REVENUE_ROUTER_POSITION_MANAGER_ROLE: 7n,
  COMMERCE_DISPUTES_CALLER_ROLE: 13n,
  HOUSING_MARKETPLACE_CALLER_ROLE: 14n
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
    abi: COMMUNITY_REGISTRY_ABI,
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

  const revenueRouter = (await publicClient.readContract({
    address: marketplace,
    abi: MARKETPLACE_ABI,
    functionName: "revenueRouter"
  })) as `0x${string}`;

  let vptInitialized: boolean;
  try {
    vptInitialized = (await publicClient.readContract({
      address: verifierPowerToken,
      abi: VPT_ABI_BY_COMMUNITY,
      functionName: "communityInitialized",
      args: [BigInt(communityId)]
    })) as boolean;
  } catch {
    vptInitialized = (await publicClient.readContract({
      address: verifierPowerToken,
      abi: VPT_ABI_GLOBAL,
      functionName: "communityInitialized"
    })) as boolean;
  }

  const [rrPosRole, rrDistributor, disputesCaller, housingCaller, vaIssuerRole, communityActive, treasury] =
    await Promise.all([
      publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE, positionManager]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [ROLES.REVENUE_ROUTER_DISTRIBUTOR_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [ROLES.COMMERCE_DISPUTES_CALLER_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [ROLES.HOUSING_MARKETPLACE_CALLER_ROLE, marketplace]
      }),
      publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, requestHub]
      }),
      publicClient.readContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "communityActive",
        args: [BigInt(communityId)]
      }),
      publicClient.readContract({
        address: revenueRouter,
        abi: REVENUE_ROUTER_ABI,
        functionName: "communityTreasuries",
        args: [BigInt(communityId)]
      })
    ]);

  return {
    communityId,
    modules: {
      valuableActionRegistryMatches:
        valuableActionRegistry.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    },
    vptInitialized,
    roles: {
      rrPositionManager: rrPosRole,
      rrDistributor: rrDistributor,
      commerceDisputesCaller: disputesCaller,
      housingMarketplaceCaller: housingCaller,
      vaIssuerRequestHub: vaIssuerRole
    },
    marketplaceActive: communityActive,
    revenueTreasurySet: treasury.toLowerCase() !== "0x0000000000000000000000000000000000000000"
  };
}
