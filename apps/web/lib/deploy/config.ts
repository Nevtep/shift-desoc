import type { Address } from "viem";

export type CommunityDeploymentConfig = {
  communityName: string;
  communityDescription: string;
  communityMetadataUri: string;
  treasuryVault: string;
  treasuryStableToken: string;
  supportedTokensCsv: string;
};

export type DeploymentConfigValidation = {
  isValid: boolean;
  errors: string[];
};

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isAddress(value: string): value is Address {
  return ADDRESS_REGEX.test(value.trim());
}

export function createDefaultDeploymentConfig(connectedAddress?: `0x${string}`): CommunityDeploymentConfig {
  const fallback = connectedAddress ?? "";
  return {
    communityName: "",
    communityDescription: "",
    communityMetadataUri: "",
    treasuryVault: fallback,
    treasuryStableToken: "",
    supportedTokensCsv: ""
  };
}

export function validateDeploymentConfig(config: CommunityDeploymentConfig): DeploymentConfigValidation {
  const errors: string[] = [];

  if (!config.communityName.trim()) errors.push("Community name is required.");
  if (!config.communityDescription.trim()) errors.push("Community description is required.");
  if (!config.treasuryVault.trim()) errors.push("Treasury vault address is required.");
  if (!config.treasuryStableToken.trim()) errors.push("Treasury stable token address is required.");
  if (!config.supportedTokensCsv.trim()) errors.push("At least one supported token address is required.");

  if (config.treasuryVault.trim() && !isAddress(config.treasuryVault)) {
    errors.push("Treasury vault must be a valid 0x address.");
  }

  if (config.treasuryStableToken.trim() && !isAddress(config.treasuryStableToken)) {
    errors.push("Treasury stable token must be a valid 0x address.");
  }

  if (config.supportedTokensCsv.trim()) {
    const tokens = config.supportedTokensCsv
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      errors.push("At least one supported token address is required.");
    } else if (tokens.some((token) => !isAddress(token))) {
      errors.push("Supported tokens must be valid comma-separated 0x addresses.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
