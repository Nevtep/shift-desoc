import { ethers } from "hardhat";

/**
 * Deploy Master Infrastructure (Run once)
 * 
 * This script deploys the shared infrastructure that all communities use:
 * - CommunityRegistry (central registry)
 * - CountingMultiChoice (shared voting module)
 * - CommunityFactory (factory for new communities) 
 * - Template contracts for cloning
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Shift DeSoc Master Infrastructure...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // External contracts (already deployed)
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

  // =================================================================
  // STEP 1: Deploy Shared Infrastructure
  // =================================================================
  
  console.log("\n=== SHARED INFRASTRUCTURE ===");
  
  // Deploy CommunityRegistry
  console.log("\n🌐 Deploying CommunityRegistry...");
  const CommunityRegistry = await ethers.getContractFactory("CommunityRegistry");
  const communityRegistry = await CommunityRegistry.deploy(deployer.address);
  await communityRegistry.waitForDeployment();
  console.log("✅ CommunityRegistry deployed to:", await communityRegistry.getAddress());

  // Deploy CountingMultiChoice (shared voting module)
  console.log("\n🗳️ Deploying CountingMultiChoice...");
  const CountingMultiChoice = await ethers.getContractFactory("CountingMultiChoice");
  const countingMultiChoice = await CountingMultiChoice.deploy();
  await countingMultiChoice.waitForDeployment();
  console.log("✅ CountingMultiChoice deployed to:", await countingMultiChoice.getAddress());

  // =================================================================
  // STEP 2: Deploy Template Contracts (for cloning)
  // =================================================================
  
  console.log("\n=== TEMPLATE CONTRACTS ===");

  // Template 0: ShiftGovernor (deploy a real instance first to get the template)
  console.log("\n🏛️ Deploying ShiftGovernor template...");
  
  // First deploy a temporary MembershipToken for the template
  const TempToken = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const tempToken = await TempToken.deploy("Template Token", "TMPL", 1, deployer.address);
  await tempToken.waitForDeployment();
  
  // Deploy a temporary Timelock for the template
  const TempTimelock = await ethers.getContractFactory("TimelockController");
  const tempTimelock = await TempTimelock.deploy(
    3600, // 1 hour delay
    [], 
    [], 
    deployer.address // Use deployer as admin temporarily
  );
  await tempTimelock.waitForDeployment();
  
  const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
  const governorTemplate = await ShiftGovernor.deploy(
    await tempToken.getAddress(),
    await tempTimelock.getAddress()
  );
  await governorTemplate.waitForDeployment();
  console.log("✅ Governor template deployed to:", await governorTemplate.getAddress());

  // Template 1: TimelockController
  console.log("\n⏰ Deploying TimelockController template...");
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelockTemplate = await TimelockController.deploy(
    3600, // 1 hour delay
    [], 
    [], 
    deployer.address // Use deployer as admin temporarily
  );
  await timelockTemplate.waitForDeployment();
  console.log("✅ Timelock template deployed to:", await timelockTemplate.getAddress());

  // Template 2: MembershipTokenERC20Votes
  console.log("\n🪙 Deploying MembershipToken template...");
  const MembershipToken = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const membershipTokenTemplate = await MembershipToken.deploy(
    "Template", 
    "TPL",
    1, 
    deployer.address
  );
  await membershipTokenTemplate.waitForDeployment();
  console.log("✅ MembershipToken template deployed to:", await membershipTokenTemplate.getAddress());

  // Template 3: ValuableActionRegistry
  console.log("\n⚙️ Deploying ValuableActionRegistry template...");
  const ValuableActionRegistry = await ethers.getContractFactory("ValuableActionRegistry");
  const valuableActionRegistryTemplate = await ValuableActionRegistry.deploy(
    deployer.address // Use deployer as governance temporarily
  );
  await valuableActionRegistryTemplate.waitForDeployment();
  console.log("✅ ValuableActionRegistry template deployed to:", await valuableActionRegistryTemplate.getAddress());

  // Template 4: Claims
  console.log("\n✅ Deploying Claims template...");
  const Claims = await ethers.getContractFactory("Claims");
  const claimsTemplate = await Claims.deploy(
    deployer.address, // governance
    await valuableActionRegistryTemplate.getAddress(), // actionRegistry
    deployer.address, // verifierPool placeholder
    deployer.address, // workerSBT placeholder  
    await tempToken.getAddress() // membershipToken
  );
  await claimsTemplate.waitForDeployment();
  console.log("✅ Claims template deployed to:", await claimsTemplate.getAddress());

  // Template 5: RequestHub
  console.log("\n💬 Deploying RequestHub template...");
  const RequestHub = await ethers.getContractFactory("RequestHub");
  const requestHubTemplate = await RequestHub.deploy(
    await communityRegistry.getAddress()
  );
  await requestHubTemplate.waitForDeployment();
  console.log("✅ RequestHub template deployed to:", await requestHubTemplate.getAddress());

  // Template 6: DraftsManager
  console.log("\n📝 Deploying DraftsManager template...");
  const DraftsManager = await ethers.getContractFactory("DraftsManager");
  const draftsManagerTemplate = await DraftsManager.deploy(
    await communityRegistry.getAddress(),
    await governorTemplate.getAddress() // Use deployed template governor
  );
  await draftsManagerTemplate.waitForDeployment();
  console.log("✅ DraftsManager template deployed to:", await draftsManagerTemplate.getAddress());

  // Template 7: CommunityToken
  console.log("\n💰 Deploying CommunityToken template...");
  const CommunityToken = await ethers.getContractFactory("CommunityToken");
  const communityTokenTemplate = await CommunityToken.deploy(
    1, // placeholder communityId (non-zero)
    USDC_BASE_SEPOLIA,
    deployer.address, // Use deployer as treasury temporarily
    1000000000 * 10**6 // maxSupply (1B tokens)
  );
  await communityTokenTemplate.waitForDeployment();
  console.log("✅ CommunityToken template deployed to:", await communityTokenTemplate.getAddress());

  // Template 8: WorkerSBT
  console.log("\n🎖️ Deploying WorkerSBT template...");
  const WorkerSBT = await ethers.getContractFactory("WorkerSBT");
  const workerSBTTemplate = await WorkerSBT.deploy(
    deployer.address, // placeholder claimsManager
    deployer.address  // placeholder governance
  );
  await workerSBTTemplate.waitForDeployment();
  console.log("✅ WorkerSBT template deployed to:", await workerSBTTemplate.getAddress());

  // Template 9: VerifierPool
  console.log("\n👥 Deploying VerifierPool template...");
  const VerifierPool = await ethers.getContractFactory("VerifierPool");
  const verifierPoolTemplate = await VerifierPool.deploy(
    deployer.address // Use deployer as governance temporarily
  );
  await verifierPoolTemplate.waitForDeployment();
  console.log("✅ VerifierPool template deployed to:", await verifierPoolTemplate.getAddress());

  // Template 10: TreasuryAdapter
  console.log("\n🏦 Deploying TreasuryAdapter template...");
  const TreasuryAdapter = await ethers.getContractFactory("TreasuryAdapter");
  const treasuryAdapterTemplate = await TreasuryAdapter.deploy(
    await communityRegistry.getAddress(),
    1 // placeholder communityId (non-zero)
  );
  await treasuryAdapterTemplate.waitForDeployment();
  console.log("✅ TreasuryAdapter template deployed to:", await treasuryAdapterTemplate.getAddress());

  // =================================================================
  // STEP 3: Deploy CommunityFactory with all templates
  // =================================================================
  
  console.log("\n=== COMMUNITY FACTORY ===");
  
  // Prepare template addresses array
  const templates = [
    await governorTemplate.getAddress(),
    await timelockTemplate.getAddress(),
    await membershipTokenTemplate.getAddress(),
    await valuableActionRegistryTemplate.getAddress(),
    await claimsTemplate.getAddress(),
    await requestHubTemplate.getAddress(),
    await draftsManagerTemplate.getAddress(),
    await communityTokenTemplate.getAddress(),
    await workerSBTTemplate.getAddress(),
    await verifierPoolTemplate.getAddress(),
    await treasuryAdapterTemplate.getAddress()
  ];

  console.log("\n🏭 Deploying CommunityFactory...");
  const CommunityFactory = await ethers.getContractFactory("CommunityFactory");
  const communityFactory = await CommunityFactory.deploy(
    await communityRegistry.getAddress(),
    await countingMultiChoice.getAddress(),
    templates
  );
  await communityFactory.waitForDeployment();
  console.log("✅ CommunityFactory deployed to:", await communityFactory.getAddress());

  // =================================================================
  // STEP 4: Setup Permissions
  // =================================================================
  
  console.log("\n=== PERMISSIONS SETUP ===");
  
  // Grant factory permission to create communities in registry
  console.log("\n🔐 Granting factory permissions...");
  await communityRegistry.grantRole(
    await communityRegistry.COMMUNITY_CREATOR_ROLE(),
    await communityFactory.getAddress()
  );
  console.log("✅ Factory granted COMMUNITY_CREATOR_ROLE");

  // =================================================================
  // DEPLOYMENT SUMMARY
  // =================================================================
  
  console.log("\n🎯 MASTER INFRASTRUCTURE DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("Gas Used: [Check transaction receipts]");
  
  console.log("\n📋 SHARED CONTRACTS:");
  console.log("├── CommunityRegistry:", await communityRegistry.getAddress());
  console.log("├── CountingMultiChoice:", await countingMultiChoice.getAddress());
  console.log("└── CommunityFactory:", await communityFactory.getAddress());
  
  console.log("\n🎨 TEMPLATE CONTRACTS:");
  console.log("├── Governor Template:", await governorTemplate.getAddress());
  console.log("├── Timelock Template:", await timelockTemplate.getAddress()); 
  console.log("├── MembershipToken Template:", await membershipTokenTemplate.getAddress());
  console.log("├── ValuableActionRegistry Template:", await valuableActionRegistryTemplate.getAddress());
  console.log("├── Claims Template:", await claimsTemplate.getAddress());
  console.log("├── RequestHub Template:", await requestHubTemplate.getAddress());
  console.log("├── DraftsManager Template:", await draftsManagerTemplate.getAddress());
  console.log("├── CommunityToken Template:", await communityTokenTemplate.getAddress());
  console.log("├── WorkerSBT Template:", await workerSBTTemplate.getAddress());
  console.log("├── VerifierPool Template:", await verifierPoolTemplate.getAddress());
  console.log("└── TreasuryAdapter Template:", await treasuryAdapterTemplate.getAddress());

  console.log("\n🌐 EXTERNAL CONTRACTS:");
  console.log("├── USDC (Base Sepolia):", USDC_BASE_SEPOLIA);
  console.log("└── Multicall3:", MULTICALL3);

  console.log("\n📋 NEXT STEPS:");
  console.log("=".repeat(40));
  console.log("1. ✅ Master infrastructure deployed");
  console.log("2. 🏠 Ready to create communities via CommunityFactory");
  console.log("3. 👤 Run create-community script with founder address");
  console.log("4. 🌐 Verify contracts on Base Sepolia block explorer");
  
  console.log("\n💾 SAVE THESE ADDRESSES:");
  console.log(`CommunityRegistry: ${await communityRegistry.getAddress()}`);
  console.log(`CommunityFactory: ${await communityFactory.getAddress()}`);
  console.log(`CountingMultiChoice: ${await countingMultiChoice.getAddress()}`);

  return {
    communityRegistry: await communityRegistry.getAddress(),
    communityFactory: await communityFactory.getAddress(),
    countingMultiChoice: await countingMultiChoice.getAddress(),
    templates
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});