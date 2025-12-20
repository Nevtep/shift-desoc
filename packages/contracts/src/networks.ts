export const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  8453: "base",
  84532: "base_sepolia",
  31337: "hardhat",
  1337: "hardhat"
};

export const KNOWN_NETWORKS = new Set(Object.values(CHAIN_ID_TO_NETWORK));
