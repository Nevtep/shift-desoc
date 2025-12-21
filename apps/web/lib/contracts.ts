import type { Abi, Address } from "viem";
import { baseSepolia } from "wagmi/chains";

import communityRegistryArtifact from "../abis/CommunityRegistry.json" assert { type: "json" };
import requestHubArtifact from "../abis/RequestHub.json" assert { type: "json" };
import draftsManagerArtifact from "../abis/DraftsManager.json" assert { type: "json" };
import claimsArtifact from "../abis/Claims.json" assert { type: "json" };
import governorArtifact from "../abis/ShiftGovernor.json" assert { type: "json" };
import baseSepoliaDeployment from "../../../deployments/base_sepolia.json" assert { type: "json" };

type DeploymentJson = typeof baseSepoliaDeployment;

type ContractKey = keyof DeploymentJson["addresses"];

type ChainId = typeof baseSepolia.id | number;

// Key deployments by chain id to avoid network string mismatches (base_sepolia vs base-sepolia).
const deployments: Record<number, DeploymentJson> = {
  [baseSepolia.id]: baseSepoliaDeployment
};

const requestHubAbi = requestHubArtifact.abi as Abi;
const communityRegistryAbi = communityRegistryArtifact.abi as Abi;

const claimsAbi = claimsArtifact.abi as Abi;
const governorAbi = governorArtifact.abi as Abi;
const draftsManagerAbi = draftsManagerArtifact.abi as Abi;

export const CONTRACTS = {
  requestHub: {
    key: "requestHub" as ContractKey,
    abi: requestHubAbi
  },
  claims: {
    key: "claims" as ContractKey,
    abi: claimsAbi
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
  }
};

export function getContractAddress(key: ContractKey, chainId?: ChainId): Address {
  const requestedChain = Number(chainId) || baseSepolia.id;

  if (requestedChain !== baseSepolia.id) {
    throw new Error("Unsupported chain. Switch to Base Sepolia.");
  }

  const deployment = deployments[baseSepolia.id];

  if (!deployment) {
    throw new Error("No deployments configured");
  }

  const addr = deployment.addresses[key];
  if (!addr) {
    throw new Error(`Missing address for ${key}`);
  }

  return addr as Address;
}

export function getContractConfig<TAbi extends Abi>(key: keyof typeof CONTRACTS, chainId?: ChainId) {
  const meta = CONTRACTS[key];
  return {
    address: getContractAddress(meta.key, chainId),
    abi: meta.abi as TAbi
  } as const;
}
