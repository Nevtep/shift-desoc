import hre from "hardhat";
import {
  CommunityDeployConfig,
  CommunityStackAddresses,
  defaultCommunityDeployConfig,
  loadDeploymentFile,
  wireCommunityRoles,
} from "./community-deploy-lib";

const { ethers } = hre;

function parseAddresses(csv: string | undefined, fallback: string[]): string[] {
  if (!csv) return fallback;
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployment = loadDeploymentFile();
  if (!deployment?.addresses || !deployment.communityId) {
    throw new Error("No deployment found. Run deploy-shared-infra and deploy-community-stack first.");
  }

  const baseConfig = defaultCommunityDeployConfig(deployer.address);
  const config: CommunityDeployConfig = {
    ...baseConfig,
    founderAddress: process.env.FOUNDER_ADDRESS || baseConfig.founderAddress,
    treasuryVault: process.env.TREASURY_VAULT || baseConfig.treasuryVault,
    treasuryStableToken: process.env.TREASURY_STABLE_TOKEN || baseConfig.treasuryStableToken,
    supportedTokens: parseAddresses(process.env.SUPPORTED_TOKENS, baseConfig.supportedTokens),
    initialMembershipTokens: BigInt(process.env.INITIAL_MEMBERSHIP_TOKENS || "0"),
    vptMetadataURI: process.env.VPT_METADATA_URI || baseConfig.vptMetadataURI,
    communityName: process.env.COMMUNITY_NAME || baseConfig.communityName,
    communityDescription: process.env.COMMUNITY_DESCRIPTION || baseConfig.communityDescription,
    communityMetadataURI: process.env.COMMUNITY_METADATA_URI || baseConfig.communityMetadataURI,
    proposalThreshold: BigInt(process.env.PROPOSAL_THRESHOLD || "0"),
    votingDelay: Number(process.env.VOTING_DELAY || baseConfig.votingDelay),
    votingPeriod: Number(process.env.VOTING_PERIOD || baseConfig.votingPeriod),
    executionDelay: Number(process.env.EXECUTION_DELAY || baseConfig.executionDelay),
    verifierPanelSize: Number(process.env.VERIFIER_PANEL_SIZE || baseConfig.verifierPanelSize),
    verifierMin: Number(process.env.VERIFIER_MIN || baseConfig.verifierMin),
    maxPanelsPerEpoch: Number(process.env.MAX_PANELS_PER_EPOCH || baseConfig.maxPanelsPerEpoch),
    useVPTWeighting:
      process.env.USE_VPT_WEIGHTING === undefined
        ? baseConfig.useVPTWeighting
        : process.env.USE_VPT_WEIGHTING === "true",
    maxWeightPerVerifier: Number(process.env.MAX_WEIGHT_PER_VERIFIER || baseConfig.maxWeightPerVerifier),
    cooldownAfterFraud: Number(process.env.COOLDOWN_AFTER_FRAUD || baseConfig.cooldownAfterFraud),
    minTreasuryBps: Number(process.env.MIN_TREASURY_BPS || baseConfig.minTreasuryBps),
    minPositionsBps: Number(process.env.MIN_POSITIONS_BPS || baseConfig.minPositionsBps),
    spilloverTarget: Number(process.env.SPILLOVER_TARGET || baseConfig.spilloverTarget),
    spilloverSplitBpsTreasury: Number(
      process.env.SPILLOVER_SPLIT_BPS_TREASURY || baseConfig.spilloverSplitBpsTreasury,
    ),
  };

  await wireCommunityRoles(
    deployment.communityId,
    deployment.addresses as CommunityStackAddresses,
    config,
  );

  console.log(`✅ Role wiring complete (communityId=${deployment.communityId})`);
}

main().catch((error) => {
  console.error("❌ post-deploy-role-wiring failed", error);
  process.exitCode = 1;
});
