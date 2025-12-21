import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Create Community Directly (without CommunityFactory)
 *
 * Since CommunityFactory is too large to deploy, we'll create communities
 * by deploying contracts directly and setting up the connections manually.
 */

interface DeployedAddresses {
  deployer: string;
  communityRegistry: string;
  countingMultiChoice: string;
  governorTemplate: string;
  timelockTemplate: string;
  membershipTokenTemplate: string;
  valuableActionRegistryTemplate: string;
  claimsTemplate: string;
  requestHubTemplate: string;
  draftsManagerTemplate: string;
  communityTokenTemplate: string;
  workerSBTTemplate: string;
  verifierPoolTemplate: string;
  treasuryAdapterTemplate: string;
}

const ADDRESSES_FILE = join(__dirname, "deployed-addresses.json");

function loadAddresses(): DeployedAddresses {
  const content = readFileSync(ADDRESSES_FILE, "utf8");
  return JSON.parse(content);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🏠 Creating New Shift Community Directly...");
  console.log("Founder/Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );

  // Load deployed infrastructure addresses
  const addresses = loadAddresses();
  console.log("📁 Loaded infrastructure addresses");

  // External contracts
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  // Community Configuration
  const COMMUNITY_CONFIG = {
    name: "Pioneers Community",
    description:
      "First community on Shift DeSoc - focused on building the future of decentralized coordination",
    metadataURI: "ipfs://QmPioneersCommunityMetadata123",
    parentCommunityId: 0, // 0 = root community
  };

  console.log(`📝 Creating Community: ${COMMUNITY_CONFIG.name}`);

  // =================================================================
  // STEP 1: Deploy MembershipToken for the community
  // =================================================================

  console.log("\n=== DEPLOYING COMMUNITY CONTRACTS ===");

  console.log("\n🪙 Deploying MembershipToken...");
  const MembershipToken = await ethers.getContractFactory(
    "MembershipTokenERC20Votes",
  );
  const membershipToken = await MembershipToken.deploy(
    `${COMMUNITY_CONFIG.name} Membership`,
    "SHIFT-MEMBER-1",
    1, // communityId will be updated after registry
    deployer.address,
  );
  await membershipToken.waitForDeployment();
  const membershipTokenAddress = await membershipToken.getAddress();
  console.log("✅ MembershipToken deployed to:", membershipTokenAddress);

  // =================================================================
  // STEP 2: Deploy TimelockController
  // =================================================================

  console.log("\n⏰ Deploying TimelockController...");
  const TimelockController =
    await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    24 * 60 * 60, // 1 day delay
    [], // proposers (will be set to governor)
    [], // executors (will be set to governor)
    deployer.address, // admin (temporary)
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("✅ TimelockController deployed to:", timelockAddress);

  // =================================================================
  // STEP 3: Deploy ShiftGovernor
  // =================================================================

  console.log("\n🏛️ Deploying ShiftGovernor...");
  const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
  const governor = await ShiftGovernor.deploy(
    membershipTokenAddress,
    timelockAddress,
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("✅ ShiftGovernor deployed to:", governorAddress);

  // =================================================================
  // STEP 4: Deploy ValuableActionRegistry
  // =================================================================

  console.log("\n⚙️ Deploying ValuableActionRegistry...");
  const ValuableActionRegistry = await ethers.getContractFactory(
    "ValuableActionRegistry",
  );
  const valuableActionRegistry =
    await ValuableActionRegistry.deploy(timelockAddress, addresses.communityRegistry);
  await valuableActionRegistry.waitForDeployment();
  const valuableActionRegistryAddress =
    await valuableActionRegistry.getAddress();
  console.log(
    "✅ ValuableActionRegistry deployed to:",
    valuableActionRegistryAddress,
  );

  // =================================================================
  // STEP 5: Deploy CommunityToken
  // =================================================================

  console.log("\n💰 Deploying CommunityToken...");
  const CommunityToken = await ethers.getContractFactory("CommunityToken");
  const communityToken = await CommunityToken.deploy(
    USDC_BASE_SEPOLIA,
    1, // communityId (will be updated after registry)
    `${COMMUNITY_CONFIG.name} Token`,
    "SHIFT-CT-1",
    deployer.address, // treasury
    ethers.parseEther("1000000"), // 1M max supply
  );
  await communityToken.waitForDeployment();
  const communityTokenAddress = await communityToken.getAddress();
  console.log("✅ CommunityToken deployed to:", communityTokenAddress);

  // =================================================================
  // STEP 6: Deploy WorkerSBT
  // =================================================================

  console.log("\n🎖️ Deploying WorkerSBT...");
  const WorkerSBT = await ethers.getContractFactory("WorkerSBT");
  const workerSBT = await WorkerSBT.deploy(
    deployer.address, // initial owner
    deployer.address, // manager (will be updated to Claims)
    governorAddress, // governance
  );
  await workerSBT.waitForDeployment();
  const workerSBTAddress = await workerSBT.getAddress();
  console.log("✅ WorkerSBT deployed to:", workerSBTAddress);

  // =================================================================
  // STEP 7: Deploy VerifierPool
  // =================================================================

  console.log("\n👥 Deploying VerifierPool...");
  const VerifierPool = await ethers.getContractFactory("VerifierPool");
  const verifierPool = await VerifierPool.deploy(governorAddress);
  await verifierPool.waitForDeployment();
  const verifierPoolAddress = await verifierPool.getAddress();
  console.log("✅ VerifierPool deployed to:", verifierPoolAddress);

  // =================================================================
  // STEP 8: Deploy Claims
  // =================================================================

  console.log("\n✅ Deploying Claims...");
  const Claims = await ethers.getContractFactory("Claims");
  const claims = await Claims.deploy(
    governorAddress, // governance
    valuableActionRegistryAddress, // actionRegistry
    verifierPoolAddress, // verifierPool
    workerSBTAddress, // workerSBT
    membershipTokenAddress, // membershipToken
  );
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log("✅ Claims deployed to:", claimsAddress);

  // =================================================================
  // STEP 9: Deploy RequestHub
  // =================================================================

  console.log("\n💬 Deploying RequestHub...");
  const RequestHub = await ethers.getContractFactory("RequestHub");
  const requestHub = await RequestHub.deploy(addresses.communityRegistry);
  await requestHub.waitForDeployment();
  const requestHubAddress = await requestHub.getAddress();
  console.log("✅ RequestHub deployed to:", requestHubAddress);

  // =================================================================
  // STEP 10: Deploy DraftsManager
  // =================================================================

  console.log("\n📝 Deploying DraftsManager...");
  const DraftsManager = await ethers.getContractFactory("DraftsManager");
  const draftsManager = await DraftsManager.deploy(
    addresses.communityRegistry,
    governorAddress,
  );
  await draftsManager.waitForDeployment();
  const draftsManagerAddress = await draftsManager.getAddress();
  console.log("✅ DraftsManager deployed to:", draftsManagerAddress);

  // =================================================================
  // STEP 11: Register Community in CommunityRegistry
  // =================================================================

  console.log("\n=== REGISTERING COMMUNITY ===");

  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    addresses.communityRegistry,
  );

  console.log("\n🏠 Registering community in registry...");
  const registerTx = await communityRegistry.registerCommunity(
    COMMUNITY_CONFIG.name,
    COMMUNITY_CONFIG.description,
    COMMUNITY_CONFIG.metadataURI,
    COMMUNITY_CONFIG.parentCommunityId,
  );
  const receipt = await registerTx.wait();

  // Get community ID from events
  const communityRegisteredEvent = receipt?.logs?.find((log: any) => {
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
  const communityId = parsedEvent?.args?.communityId;
  console.log("✅ Community registered with ID:", communityId?.toString());

  // =================================================================
  // STEP 12: Set Module Addresses in Registry
  // =================================================================

  console.log("\n🔧 Setting module addresses in registry...");

  const moduleUpdates = [
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("governor")),
      address: governorAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("timelock")),
      address: timelockAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("membershipToken")),
      address: membershipTokenAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("requestHub")),
      address: requestHubAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("draftsManager")),
      address: draftsManagerAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("claimsManager")),
      address: claimsAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("valuableActionRegistry")),
      address: valuableActionRegistryAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("verifierPool")),
      address: verifierPoolAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("workerSBT")),
      address: workerSBTAddress,
    },
    {
      key: ethers.keccak256(ethers.toUtf8Bytes("communityToken")),
      address: communityTokenAddress,
    },
  ];

  for (const module of moduleUpdates) {
    await communityRegistry.setModuleAddress(
      communityId,
      module.key,
      module.address,
    );
  }
  console.log("✅ All module addresses registered");

  // =================================================================
  // STEP 13: Setup Governance Permissions
  // =================================================================

  console.log("\n=== SETTING UP PERMISSIONS ===");

  // Grant governor roles on timelock
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  console.log("\n🔐 Setting up timelock permissions...");
  await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
  console.log("✅ Governor granted timelock roles");

  // Setup CountingMultiChoice connection
  console.log("\n🗳️ Setting up multi-choice voting...");
  await governor.initCountingMulti(addresses.countingMultiChoice);
  console.log("✅ CountingMultiChoice connected to governor");

  // Grant minter role to claims contract
  console.log("\n🪙 Setting up token minting permissions...");
  const MINTER_ROLE = await membershipToken.MINTER_ROLE();
  await membershipToken.grantRole(MINTER_ROLE, claimsAddress);
  console.log("✅ Claims contract granted minter role");

  // Update WorkerSBT manager to Claims
  const MANAGER_ROLE = await workerSBT.MANAGER_ROLE();
  await workerSBT.grantRole(MANAGER_ROLE, claimsAddress);
  console.log("✅ Claims contract granted WorkerSBT manager role");

  // Set VerifierPool claims contract
  await verifierPool.setClaimsContract(claimsAddress);
  console.log("✅ VerifierPool connected to Claims");

  // =================================================================
  // STEP 14: Founder Bootstrap
  // =================================================================

  console.log("\n=== FOUNDER BOOTSTRAP ===");

  // Mint initial tokens to founder
  const FOUNDER_INITIAL_TOKENS = ethers.parseEther("10000");

  console.log("\n🪙 Minting initial tokens to founder...");
  await membershipToken.mint(deployer.address, FOUNDER_INITIAL_TOKENS);

  // Delegate voting power to self
  await membershipToken.delegate(deployer.address);

  const founderBalance = await membershipToken.balanceOf(deployer.address);
  const votingPower = await membershipToken.getVotes(deployer.address);

  console.log("✅ Founder tokens minted:", ethers.formatEther(founderBalance));
  console.log("✅ Founder voting power:", ethers.formatEther(votingPower));

  // Renounce temporary admin roles
  console.log("\n🔐 Renouncing temporary admin roles...");
  await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log(
    "✅ Renounced timelock admin role (governance is now in control)",
  );

  // =================================================================
  // DEPLOYMENT SUMMARY
  // =================================================================

  console.log("\n🎉 COMMUNITY CREATION SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Gas Used: Check individual transaction receipts");
  console.log(
    "Final Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );

  console.log("\n🏠 COMMUNITY DETAILS:");
  console.log("├── ID:", communityId?.toString());
  console.log("├── Name:", COMMUNITY_CONFIG.name);
  console.log("├── Founder:", deployer.address);
  console.log("└── Parent ID:", COMMUNITY_CONFIG.parentCommunityId);

  console.log("\n🏛️ GOVERNANCE INFRASTRUCTURE:");
  console.log("├── Governor:", governorAddress);
  console.log("├── Timelock:", timelockAddress);
  console.log("├── MembershipToken:", membershipTokenAddress);
  console.log("└── CountingMultiChoice:", addresses.countingMultiChoice);

  console.log("\n⚙️ WORK VERIFICATION SYSTEM:");
  console.log("├── ValuableActionRegistry:", valuableActionRegistryAddress);
  console.log("├── Claims:", claimsAddress);
  console.log("├── VerifierPool:", verifierPoolAddress);
  console.log("└── WorkerSBT:", workerSBTAddress);

  console.log("\n💬 COORDINATION INFRASTRUCTURE:");
  console.log("├── RequestHub:", requestHubAddress);
  console.log("├── DraftsManager:", draftsManagerAddress);
  console.log("└── CommunityRegistry:", addresses.communityRegistry);

  console.log("\n💰 ECONOMIC INFRASTRUCTURE:");
  console.log("├── CommunityToken:", communityTokenAddress);
  console.log("└── USDC (backing):", USDC_BASE_SEPOLIA);

  console.log("\n📋 FOUNDER NEXT STEPS:");
  console.log("=".repeat(40));
  console.log("1. 📝 Create initial ValuableActions via governance proposals");
  console.log("2. 👥 Invite community members and distribute tokens");
  console.log("3. 💬 Post first request in RequestHub");
  console.log("4. 📄 Create first draft with governance proposals");
  console.log("5. 🗳️ Conduct first governance vote");
  console.log("6. 🎖️ Start worker verification through Claims system");

  console.log("\n💾 SAVE THESE ADDRESSES FOR UI:");
  const addressesForUI = {
    communityId: communityId?.toString(),
    communityRegistry: addresses.communityRegistry,
    countingMultiChoice: addresses.countingMultiChoice,
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
  };

  console.log(JSON.stringify(addressesForUI, null, 2));

  return addressesForUI;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
