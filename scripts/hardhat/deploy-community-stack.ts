import hre from "hardhat";
import {
  CommunityDeployConfig,
  defaultCommunityDeployConfig,
  deployCommunityStack,
  loadDeploymentFile,
  saveDeploymentFile,
} from "./community-deploy-lib";

const { ethers, network } = hre;

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function parseAddresses(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const base = defaultCommunityDeployConfig(deployer.address);

  const config: CommunityDeployConfig = {
    ...base,
    communityName: process.env.COMMUNITY_NAME || base.communityName,
    communityDescription: process.env.COMMUNITY_DESCRIPTION || base.communityDescription,
    communityMetadataURI: process.env.COMMUNITY_METADATA_URI || base.communityMetadataURI,
    founderAddress: process.env.FOUNDER_ADDRESS || base.founderAddress,
    treasuryVault: process.env.TREASURY_VAULT || base.treasuryVault,
    treasuryStableToken: process.env.TREASURY_STABLE_TOKEN || base.treasuryStableToken,
    supportedTokens: parseAddresses(process.env.SUPPORTED_TOKENS).length
      ? parseAddresses(process.env.SUPPORTED_TOKENS)
      : base.supportedTokens,
    initialMembershipTokens: BigInt(process.env.INITIAL_MEMBERSHIP_TOKENS || "0"),
    proposalThreshold: BigInt(process.env.PROPOSAL_THRESHOLD || "0"),
    votingDelay: Number(process.env.VOTING_DELAY || base.votingDelay),
    votingPeriod: Number(process.env.VOTING_PERIOD || base.votingPeriod),
    executionDelay: Number(process.env.EXECUTION_DELAY || base.executionDelay),
    verifierPanelSize: Number(process.env.VERIFIER_PANEL_SIZE || base.verifierPanelSize),
    verifierMin: Number(process.env.VERIFIER_MIN || base.verifierMin),
    maxPanelsPerEpoch: Number(process.env.MAX_PANELS_PER_EPOCH || base.maxPanelsPerEpoch),
    useVPTWeighting: parseBool(process.env.USE_VPT_WEIGHTING, base.useVPTWeighting),
    maxWeightPerVerifier: Number(process.env.MAX_WEIGHT_PER_VERIFIER || base.maxWeightPerVerifier),
    cooldownAfterFraud: Number(process.env.COOLDOWN_AFTER_FRAUD || base.cooldownAfterFraud),
    minTreasuryBps: Number(process.env.MIN_TREASURY_BPS || base.minTreasuryBps),
    minPositionsBps: Number(process.env.MIN_POSITIONS_BPS || base.minPositionsBps),
    spilloverTarget: Number(process.env.SPILLOVER_TARGET || base.spilloverTarget),
    spilloverSplitBpsTreasury: Number(
      process.env.SPILLOVER_SPLIT_BPS_TREASURY || base.spilloverSplitBpsTreasury,
    ),
    vptMetadataURI: process.env.VPT_METADATA_URI || base.vptMetadataURI,
  };

  const result = await deployCommunityStack(config);

  const existing = loadDeploymentFile(network.name);
  saveDeploymentFile(
    {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      communityId: result.communityId,
      addresses: {
        ...(existing?.addresses ?? {}),
        ...result.addresses,
      },
      configuration: {
        communityName: config.communityName,
        votingDelay: config.votingDelay,
        votingPeriod: config.votingPeriod,
        executionDelay: config.executionDelay,
        minTreasuryBps: config.minTreasuryBps,
        minPositionsBps: config.minPositionsBps,
        supportedTokens: config.supportedTokens,
      },
      startBlock: existing?.startBlock,
    },
    network.name,
  );

  console.log(`✅ Community stack deployed (communityId=${result.communityId})`);
}

main().catch((error) => {
  console.error("❌ deploy-community-stack failed", error);
  process.exitCode = 1;
});
