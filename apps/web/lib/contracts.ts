import type { Abi, Address } from "viem";
import { baseSepolia } from "wagmi/chains";

import communityRegistryArtifact from "../abis/CommunityRegistry.json" assert { type: "json" };
import requestHubArtifact from "../abis/RequestHub.json" assert { type: "json" };
import draftsManagerArtifact from "../abis/DraftsManager.json" assert { type: "json" };
import engagementsArtifact from "../abis/Engagements.json" assert { type: "json" };
import governorArtifact from "../abis/ShiftGovernor.json" assert { type: "json" };
import valuableActionRegistryArtifact from "../abis/ValuableActionRegistry.json" assert { type: "json" };

type LayerFactoryKey =
  | "governanceLayerFactory"
  | "verificationLayerFactory"
  | "economicLayerFactory"
  | "commerceLayerFactory"
  | "coordinationLayerFactory";

type ContractKey =
  | LayerFactoryKey
  | "communityRegistry"
  | "paramController"
  | "accessManager"
  | "governor"
  | "timelock"
  | "requestHub"
  | "draftsManager"
  | "engagements"
  | "positionManager"
  | "valuableActionRegistry"
  | "verifierPowerToken"
  | "verifierElection"
  | "verifierManager"
  | "valuableActionSBT"
  | "treasuryAdapter"
  | "communityToken"
  | "marketplace"
  | "revenueRouter"
  | "bootstrapCoordinator";

type ChainId = typeof baseSepolia.id | number;

const ENV_BY_KEY: Record<ContractKey, string> = {
  communityRegistry: "NEXT_PUBLIC_COMMUNITY_REGISTRY",
  paramController: "NEXT_PUBLIC_PARAM_CONTROLLER",
  accessManager: "NEXT_PUBLIC_ACCESS_MANAGER",
  governor: "NEXT_PUBLIC_GOVERNOR",
  timelock: "NEXT_PUBLIC_TIMELOCK",
  requestHub: "NEXT_PUBLIC_REQUEST_HUB",
  draftsManager: "NEXT_PUBLIC_DRAFTS_MANAGER",
  engagements: "NEXT_PUBLIC_ENGAGEMENTS",
  positionManager: "NEXT_PUBLIC_POSITION_MANAGER",
  valuableActionRegistry: "NEXT_PUBLIC_VALUABLE_ACTION_REGISTRY",
  verifierPowerToken: "NEXT_PUBLIC_VERIFIER_POWER_TOKEN",
  verifierElection: "NEXT_PUBLIC_VERIFIER_ELECTION",
  verifierManager: "NEXT_PUBLIC_VERIFIER_MANAGER",
  valuableActionSBT: "NEXT_PUBLIC_VALUABLE_ACTION_SBT",
  treasuryAdapter: "NEXT_PUBLIC_TREASURY_ADAPTER",
  communityToken: "NEXT_PUBLIC_COMMUNITY_TOKEN",
  marketplace: "NEXT_PUBLIC_MARKETPLACE",
  revenueRouter: "NEXT_PUBLIC_REVENUE_ROUTER",
  bootstrapCoordinator: "NEXT_PUBLIC_BOOTSTRAP_COORDINATOR",
  governanceLayerFactory: "NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY",
  verificationLayerFactory: "NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY",
  economicLayerFactory: "NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY",
  commerceLayerFactory: "NEXT_PUBLIC_COMMERCE_LAYER_FACTORY",
  coordinationLayerFactory: "NEXT_PUBLIC_COORDINATION_LAYER_FACTORY"
};

const requestHubAbi = requestHubArtifact.abi as Abi;
const communityRegistryAbi = communityRegistryArtifact.abi as Abi;

const engagementsAbi = engagementsArtifact.abi as Abi;
const governorAbi = governorArtifact.abi as Abi;
const draftsManagerAbi = draftsManagerArtifact.abi as Abi;
const valuableActionRegistryAbi = valuableActionRegistryArtifact.abi as Abi;

export const CONTRACTS = {
  requestHub: {
    key: "requestHub" as ContractKey,
    abi: requestHubAbi
  },
  engagements: {
    key: "engagements" as ContractKey,
    abi: engagementsAbi
  },
  governor: {
    key: "governor" as ContractKey,
    abi: governorAbi
  },
  draftsManager: {
    key: "draftsManager" as ContractKey,
    abi: draftsManagerAbi
  },
  communityRegistry: {
    key: "communityRegistry" as ContractKey,
    abi: communityRegistryAbi
  },
  valuableActionRegistry: {
    key: "valuableActionRegistry" as ContractKey,
    abi: valuableActionRegistryAbi
  }
};

export function getContractAddress(key: ContractKey, chainId?: ChainId): Address {
  const requestedChain = Number(chainId) || baseSepolia.id;

  if (requestedChain !== baseSepolia.id) {
    throw new Error("Unsupported chain. Switch to Base Sepolia.");
  }

  const envKey = ENV_BY_KEY[key];
  const rawAddress = process.env[envKey];
  if (!rawAddress || !/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
    throw new Error(`Missing or invalid address for ${key}. Set ${envKey} in .env for the web app.`);
  }

  return rawAddress as Address;
}

export function getContractConfig<TAbi extends Abi>(key: keyof typeof CONTRACTS, chainId?: ChainId) {
  const meta = CONTRACTS[key];
  return {
    address: getContractAddress(meta.key, chainId),
    abi: meta.abi as TAbi
  } as const;
}
