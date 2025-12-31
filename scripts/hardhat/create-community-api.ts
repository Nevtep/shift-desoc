import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * API-Friendly Community Creation Script
 *
 * This script can be called from a UI/API to create complete Shift DeSoc communities
 * using the existing successfully deployed infrastructure.
 *
 * Usage from API:
 * POST /api/create-community
 * Body: { name, description, founderAddress, governanceParams }
 */

interface CommunityParams {
  name: string;
  description: string;
  metadataURI?: string;
  founderAddress: string;
  governanceParams: {
    debateWindow: number;
    voteWindow: number;
    executionDelay: number;
    proposalThreshold: string; // ETH format string
  };
}

interface DeployedCommunity {
  communityId: number;
  founder: string;
  contracts: {
    communityRegistry: string;
    countingMultiChoice: string;
    governor: string;
    timelock: string;
    membershipToken: string;
    valuableActionRegistry: string;
    claims: string;
    verifierPool: string;
    workerSBT: string;
    requestHub: string;
    draftsManager: string;
    communityToken: string;
  };
  network: {
    name: string;
    chainId: string;
  };
  txHashes: string[];
  gasUsed: string;
  founderTokens: string;
}

// Existing deployed addresses
const DEPLOYED_ADDRESSES = {
  communityRegistry: "0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B",
  countingMultiChoice: "0x9a254605ccEf5c69Ce51b0a8C0a65016dD476c83",
};

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Main function to create a community
 * This can be called from an Express.js API endpoint
 */
export async function createCommunityForUI(
  params: CommunityParams,
): Promise<DeployedCommunity> {
  console.log("🏠 Creating Community for UI:", params.name);
  console.log("Founder:", params.founderAddress);

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const txHashes: string[] = [];
  let totalGasUsed = 0n;

  // =================================================================
  // STEP 1: Deploy Core Governance Contracts
  // =================================================================

  console.log("\n🏛️ Deploying core governance...");

  // 1. Deploy MembershipToken
  const MembershipToken = await ethers.getContractFactory(
    "MembershipTokenERC20Votes",
  );
  const membershipToken = await MembershipToken.deploy(
    `${params.name} Membership`,
    "MEMBER-TBD", // Will update after getting community ID
    1, // Temporary community ID
    params.founderAddress,
  );
  await membershipToken.waitForDeployment();
  const membershipTokenAddress = await membershipToken.getAddress();
  console.log("✅ MembershipToken:", membershipTokenAddress);
  txHashes.push(membershipToken.deploymentTransaction()?.hash || "");

  // 2. Deploy TimelockController
  const TimelockController =
    await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    params.governanceParams.executionDelay,
    [], // Empty proposers initially
    [], // Public execution
    params.founderAddress,
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("✅ Timelock:", timelockAddress);
  txHashes.push(timelock.deploymentTransaction()?.hash || "");

  // 3. Deploy Governor
  const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
  const governor = await ShiftGovernor.deploy(
    membershipTokenAddress,
    timelockAddress,
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("✅ Governor:", governorAddress);
  txHashes.push(governor.deploymentTransaction()?.hash || "");

  // =================================================================
  // STEP 2: Register Community in CommunityRegistry
  // =================================================================

  console.log("\n📋 Registering community...");

  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    DEPLOYED_ADDRESSES.communityRegistry,
  );

  const registerTx = await communityRegistry.registerCommunity(
    params.name,
    params.description,
    params.metadataURI || `ipfs://QmCommunityMetadata${Date.now()}`,
    0, // Root community
  );
  const registerReceipt = await registerTx.wait();
  txHashes.push(registerTx.hash);

  // Get community ID from events
  const communityRegisteredEvent = registerReceipt?.logs?.find((log: any) => {
    try {
      const parsed = communityRegistry.interface.parseLog(log);
      return parsed?.name === "CommunityRegistered";
    } catch {
      return false;
    }
  });

  if (!communityRegisteredEvent) {
    throw new Error("Could not find CommunityRegistered event");
  }

  const parsedEvent = communityRegistry.interface.parseLog(
    communityRegisteredEvent,
  );
  const communityId = parseInt(
    parsedEvent?.args?.communityId.toString() || "0",
  );
  console.log("✅ Community registered with ID:", communityId);

  // =================================================================
  // STEP 3: Deploy Work & Community Modules
  // =================================================================

  console.log("\n⚙️ Deploying work modules...");

  // ValuableActionRegistry
  const ValuableActionRegistry = await ethers.getContractFactory(
    "ValuableActionRegistry",
  );
  const valuableActionRegistry =
    await ValuableActionRegistry.deploy(timelockAddress, DEPLOYED_ADDRESSES.communityRegistry);
  await valuableActionRegistry.waitForDeployment();
  const valuableActionRegistryAddress =
    await valuableActionRegistry.getAddress();
  console.log("✅ ValuableActionRegistry:", valuableActionRegistryAddress);
  txHashes.push(valuableActionRegistry.deploymentTransaction()?.hash || "");

  // WorkerSBT
  const WorkerSBT = await ethers.getContractFactory("WorkerSBT");
  const workerSBT = await WorkerSBT.deploy(
    params.founderAddress, // owner
    params.founderAddress, // manager (will be updated to Claims)
    governorAddress, // governance
  );
  await workerSBT.waitForDeployment();
  const workerSBTAddress = await workerSBT.getAddress();
  console.log("✅ WorkerSBT:", workerSBTAddress);
  txHashes.push(workerSBT.deploymentTransaction()?.hash || "");

  // VerifierPool
  const VerifierPool = await ethers.getContractFactory("VerifierPool");
  const verifierPool = await VerifierPool.deploy(params.founderAddress);
  await verifierPool.waitForDeployment();
  const verifierPoolAddress = await verifierPool.getAddress();
  console.log("✅ VerifierPool:", verifierPoolAddress);
  txHashes.push(verifierPool.deploymentTransaction()?.hash || "");

  // Claims
  const Claims = await ethers.getContractFactory("Claims");
  const claims = await Claims.deploy(
    params.founderAddress, // governance
    valuableActionRegistryAddress,
    verifierPoolAddress,
    workerSBTAddress,
    membershipTokenAddress, // for minting governance tokens
  );
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log("✅ Claims:", claimsAddress);
  txHashes.push(claims.deploymentTransaction()?.hash || "");

  console.log("\n🏘️ Deploying community modules...");

  // RequestHub
  const RequestHub = await ethers.getContractFactory("RequestHub");
  const requestHub = await RequestHub.deploy(
    DEPLOYED_ADDRESSES.communityRegistry,
  );
  await requestHub.waitForDeployment();
  const requestHubAddress = await requestHub.getAddress();
  console.log("✅ RequestHub:", requestHubAddress);
  txHashes.push(requestHub.deploymentTransaction()?.hash || "");

  // DraftsManager
  const DraftsManager = await ethers.getContractFactory("DraftsManager");
  const draftsManager = await DraftsManager.deploy(
    DEPLOYED_ADDRESSES.communityRegistry,
    governorAddress,
  );
  await draftsManager.waitForDeployment();
  const draftsManagerAddress = await draftsManager.getAddress();
  console.log("✅ DraftsManager:", draftsManagerAddress);
  txHashes.push(draftsManager.deploymentTransaction()?.hash || "");

  // CommunityToken
  const CommunityToken = await ethers.getContractFactory("CommunityToken");
  const communityToken = await CommunityToken.deploy(
    USDC_BASE_SEPOLIA,
    communityId,
    `${params.name} Token`,
    `CT-${communityId}`,
    params.founderAddress, // treasury
    ethers.parseEther("1000000"), // 1M max supply
  );
  await communityToken.waitForDeployment();
  const communityTokenAddress = await communityToken.getAddress();
  console.log("✅ CommunityToken:", communityTokenAddress);
  txHashes.push(communityToken.deploymentTransaction()?.hash || "");

  // =================================================================
  // STEP 4: Setup Governance & Permissions
  // =================================================================

  console.log("\n🔐 Setting up permissions...");

  // Connect governor to CountingMultiChoice
  const initCountingTx = await governor.initCountingMulti(
    DEPLOYED_ADDRESSES.countingMultiChoice,
  );
  await initCountingTx.wait();
  console.log("✅ Governor connected to CountingMultiChoice");
  txHashes.push(initCountingTx.hash);

  // Setup timelock roles
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

  const grantProposerTx = await timelock.grantRole(
    PROPOSER_ROLE,
    governorAddress,
  );
  await grantProposerTx.wait();
  const grantExecutorTx = await timelock.grantRole(
    EXECUTOR_ROLE,
    governorAddress,
  );
  await grantExecutorTx.wait();
  console.log("✅ Governor granted timelock roles");
  txHashes.push(grantProposerTx.hash, grantExecutorTx.hash);

  // =================================================================
  // STEP 5: Bootstrap Founder (Grant deployer minter role temporarily)
  // =================================================================

  console.log("\n👑 Bootstrapping founder...");

  // Grant deployer temporary minter role for founder bootstrap
  const MINTER_ROLE = await membershipToken.MINTER_ROLE();
  const grantDeployerMinterTx = await membershipToken.grantRole(
    MINTER_ROLE,
    deployer.address,
  );
  await grantDeployerMinterTx.wait();
  txHashes.push(grantDeployerMinterTx.hash);

  const FOUNDER_TOKENS = ethers.parseEther("10000");
  const mintTx = await membershipToken.mint(
    params.founderAddress,
    FOUNDER_TOKENS,
    "Founder bootstrap allocation",
  );
  await mintTx.wait();
  console.log("✅ Founder tokens minted:", ethers.formatEther(FOUNDER_TOKENS));
  txHashes.push(mintTx.hash);

  // Grant claims minter role and revoke deployer's role
  const grantMinterTx = await membershipToken.grantRole(
    MINTER_ROLE,
    claimsAddress,
  );
  await grantMinterTx.wait();
  const revokeMinterTx = await membershipToken.renounceRole(
    MINTER_ROLE,
    deployer.address,
  );
  await revokeMinterTx.wait();
  console.log("✅ Engagements granted minter role, deployer role revoked");
  txHashes.push(grantMinterTx.hash, revokeMinterTx.hash);

  // Grant claims manager role on WorkerSBT
  const MANAGER_ROLE = await workerSBT.MANAGER_ROLE();
  const grantManagerTx = await workerSBT.grantRole(MANAGER_ROLE, claimsAddress);
  await grantManagerTx.wait();
  console.log("✅ Engagements granted WorkerSBT manager role");
  txHashes.push(grantManagerTx.hash);

  // =================================================================
  // STEP 6: Register Modules in Community Registry
  // =================================================================

  console.log("\n📝 Registering modules in community registry...");

  const moduleRegistrations = [
    { key: "governor", address: governorAddress },
    { key: "timelock", address: timelockAddress },
    { key: "engagementsManager", address: claimsAddress },
    { key: "actionTypeRegistry", address: valuableActionRegistryAddress },
    { key: "verifierPool", address: verifierPoolAddress },
    { key: "workerSBT", address: workerSBTAddress },
    { key: "requestHub", address: requestHubAddress },
    { key: "draftsManager", address: draftsManagerAddress },
    { key: "communityToken", address: communityTokenAddress },
  ];

  for (const module of moduleRegistrations) {
    try {
      const keyHash = ethers.keccak256(ethers.toUtf8Bytes(module.key));
      const setModuleTx = await communityRegistry.setModuleAddress(
        communityId,
        keyHash,
        module.address,
      );
      await setModuleTx.wait();
      txHashes.push(setModuleTx.hash);
      console.log(`✅ Registered ${module.key}`);
    } catch (error: any) {
      console.log(`⚠️ Could not register ${module.key}:`, error.message);
    }
  }

  // =================================================================
  // FINAL RESULT
  // =================================================================

  console.log("\n🎉 COMMUNITY CREATED SUCCESSFULLY!");

  const deployedCommunity: DeployedCommunity = {
    communityId,
    founder: params.founderAddress,
    contracts: {
      communityRegistry: DEPLOYED_ADDRESSES.communityRegistry,
      countingMultiChoice: DEPLOYED_ADDRESSES.countingMultiChoice,
      governor: governorAddress,
      timelock: timelockAddress,
      membershipToken: membershipTokenAddress,
      valuableActionRegistry: valuableActionRegistryAddress,
      claims: claimsAddress,
      verifierPool: verifierPoolAddress,
      workerSBT: workerSBTAddress,
      requestHub: requestHubAddress,
      draftsManager: draftsManagerAddress,
      communityToken: communityTokenAddress,
    },
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    txHashes: txHashes.filter((hash) => hash),
    gasUsed: totalGasUsed.toString(),
    founderTokens: ethers.formatEther(FOUNDER_TOKENS),
  };

  return deployedCommunity;
}

// CLI interface for direct script execution
async function main() {
  const params: CommunityParams = {
    name: process.env.COMMUNITY_NAME || "API Test Community",
    description:
      process.env.COMMUNITY_DESCRIPTION || "A test community created via API",
    founderAddress:
      process.env.FOUNDER_ADDRESS || (await ethers.getSigners())[0].address,
    governanceParams: {
      debateWindow: parseInt(process.env.DEBATE_WINDOW || "86400"), // 1 day
      voteWindow: parseInt(process.env.VOTE_WINDOW || "259200"), // 3 days
      executionDelay: parseInt(process.env.EXECUTION_DELAY || "172800"), // 2 days
      proposalThreshold: process.env.PROPOSAL_THRESHOLD || "100", // 100 tokens
    },
  };

  console.log(
    "Creating community with params:",
    JSON.stringify(params, null, 2),
  );

  try {
    const result = await createCommunityForUI(params);

    console.log("\n📄 RESULT FOR FRONTEND:");
    console.log(JSON.stringify(result, null, 2));

    // Save result to file for UI integration
    const outputFile = join(
      __dirname,
      `community-${result.communityId}-${Date.now()}.json`,
    );
    writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 Result saved to: ${outputFile}`);

    return result;
  } catch (error) {
    console.error("❌ Community creation failed:", error);
    throw error;
  }
}

// Export for API use
export { main, CommunityParams, DeployedCommunity };

// CLI execution
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
