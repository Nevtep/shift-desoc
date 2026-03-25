import { getAddress } from "viem";

export type StartupEnvInput = {
  network: "base" | "base_sepolia";
  communityRegistryAddressRaw?: string;
  communityRegistryStartBlockRaw?: string;
  communityRegistryChainIdRaw?: string;
};

export type StartupEnvValidation = {
  communityRegistryAddress: `0x${string}`;
  startBlock: number;
};

export const validateStartupEnv = (input: StartupEnvInput): StartupEnvValidation => {
  if (!input.communityRegistryAddressRaw) {
    throw new Error("Missing required env COMMUNITY_REGISTRY_ADDRESS");
  }

  if (!input.communityRegistryStartBlockRaw) {
    throw new Error("Missing required env COMMUNITY_REGISTRY_START_BLOCK");
  }

  let communityRegistryAddress: `0x${string}`;
  try {
    communityRegistryAddress = getAddress(input.communityRegistryAddressRaw) as `0x${string}`;
  } catch {
    throw new Error("Invalid COMMUNITY_REGISTRY_ADDRESS format");
  }

  if (communityRegistryAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Invalid COMMUNITY_REGISTRY_ADDRESS: zero address is not allowed");
  }

  const startBlock = Number.parseInt(input.communityRegistryStartBlockRaw, 10);
  if (!Number.isFinite(startBlock) || startBlock < 0) {
    throw new Error("Invalid COMMUNITY_REGISTRY_START_BLOCK: expected non-negative integer");
  }

  if (input.network === "base" && input.communityRegistryChainIdRaw && input.communityRegistryChainIdRaw !== "8453") {
    throw new Error("Invalid COMMUNITY_REGISTRY_CHAIN_ID for base network");
  }

  if (
    input.network === "base_sepolia" &&
    input.communityRegistryChainIdRaw &&
    input.communityRegistryChainIdRaw !== "84532"
  ) {
    throw new Error("Invalid COMMUNITY_REGISTRY_CHAIN_ID for base_sepolia network");
  }

  return { communityRegistryAddress, startBlock };
};
