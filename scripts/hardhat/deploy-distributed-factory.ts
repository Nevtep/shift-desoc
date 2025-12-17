import { ethers } from "hardhat";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Deploy Distributed Factory System
 * 
 * Deploys the new scalable community creation system:
 * 1. CommunityDeployer (Core governance)
 * 2. WorkModulesDeployer (Work verification)  
 * 3. CommunityModulesDeployer (Coordination)
 * 4. CommunityOrchestrator (Main interface)
 */

interface DistributedFactoryAddresses {
  // Shared Infrastructure (from previous deployment)
  communityRegistry?: string;
  countingMultiChoice?: string;
  
  // Distributed Factory System
  communityDeployer?: string;
  workModulesDeployer?: string;
  communityModulesDeployer?: string;
  communityOrchestrator?: string;
}

const ADDRESSES_FILE = join(__dirname, "distributed-factory-addresses.json");

function loadAddresses(): DistributedFactoryAddresses {
  if (existsSync(ADDRESSES_FILE)) {
    return JSON.parse(readFileSync(ADDRESSES_FILE, "utf8"));
  }
  return {};
}

function saveAddresses(addresses: DistributedFactoryAddresses) {
  writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
}

async function deployOrReuse<T>(
  name: string,
  factory: any,
  args: any[],
  existingAddress?: string,
  addresses?: DistributedFactoryAddresses
): Promise<{ address: string; contract: T }> {
  
  if (existingAddress && existingAddress !== "DEPLOYING") {
    console.log(`♻️  Reusing existing ${name}:`, existingAddress);
    const contract = await ethers.getContractAt(name, existingAddress);
    return { address: existingAddress, contract: contract as T };
  }
  
  console.log(`🚀 Deploying ${name}...`);
  
  // Save "DEPLOYING" status to prevent interruption issues
  if (addresses) {
    saveAddresses(addresses);
  }
  
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`✅ ${name} deployed to:`, address);
  return { address, contract };
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🏭 Deploying Distributed Factory System...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Load previous addresses
  let savedAddresses = loadAddresses();

  // =================================================================
  // STEP 1: Load existing shared infrastructure
  // =================================================================
  
  console.log("\n=== LOADING SHARED INFRASTRUCTURE ===");
  
  // Try to load from previous deployment
  const previousFile = join(__dirname, "deployed-addresses.json");
  if (existsSync(previousFile)) {
    const previousAddresses = JSON.parse(readFileSync(previousFile, "utf8"));
    savedAddresses.communityRegistry = previousAddresses.communityRegistry;
    savedAddresses.countingMultiChoice = previousAddresses.countingMultiChoice;
    console.log("✅ Loaded CommunityRegistry:", savedAddresses.communityRegistry);
    console.log("✅ Loaded CountingMultiChoice:", savedAddresses.countingMultiChoice);
  } else {
    console.log("❌ Previous deployment not found. Please deploy shared infrastructure first.");
    process.exit(1);
  }

  // =================================================================
  // STEP 2: Deploy CommunityDeployer (Core Governance)
  // =================================================================
  
  console.log("\n=== COMMUNITY DEPLOYER ===");
  
  const CoreDeployer = await ethers.getContractFactory("CoreDeployer");
  const { address: communityDeployerAddress } = await deployOrReuse(
    "CoreDeployer",
    CoreDeployer,
    [savedAddresses.countingMultiChoice],
    savedAddresses.communityDeployer,
    { ...savedAddresses, communityDeployer: "DEPLOYING" }
  );
  savedAddresses.communityDeployer = communityDeployerAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 3: Deploy WorkModulesDeployer (Work Verification)
  // =================================================================
  
  console.log("\n=== WORK MODULES DEPLOYER ===");
  
  const WorkModulesDeployer = await ethers.getContractFactory("WorkModulesDeployer");
  const { address: workModulesDeployerAddress } = await deployOrReuse(
    "WorkModulesDeployer",
    WorkModulesDeployer,
    [],
    savedAddresses.workModulesDeployer,
    { ...savedAddresses, workModulesDeployer: "DEPLOYING" }
  );
  savedAddresses.workModulesDeployer = workModulesDeployerAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 4: Deploy CommunityModulesDeployer (Coordination)
  // =================================================================
  
  console.log("\n=== COMMUNITY MODULES DEPLOYER ===");
  
  const CommunityModulesDeployer = await ethers.getContractFactory("CommunityModulesDeployer");
  const { address: communityModulesDeployerAddress } = await deployOrReuse(
    "CommunityModulesDeployer",
    CommunityModulesDeployer,
    [savedAddresses.communityRegistry],
    savedAddresses.communityModulesDeployer,
    { ...savedAddresses, communityModulesDeployer: "DEPLOYING" }
  );
  savedAddresses.communityModulesDeployer = communityModulesDeployerAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 5: Deploy CommunityOrchestrator (Main Interface)
  // =================================================================
  
  console.log("\n=== COMMUNITY ORCHESTRATOR ===");
  
  const CommunityOrchestrator = await ethers.getContractFactory("CommunityOrchestrator");
  const { address: communityOrchestratorAddress } = await deployOrReuse(
    "CommunityOrchestrator",
    CommunityOrchestrator,
    [
      savedAddresses.communityRegistry,
      savedAddresses.communityDeployer,
      savedAddresses.workModulesDeployer,
      savedAddresses.communityModulesDeployer
    ],
    savedAddresses.communityOrchestrator,
    { ...savedAddresses, communityOrchestrator: "DEPLOYING" }
  );
  savedAddresses.communityOrchestrator = communityOrchestratorAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 6: Setup Permissions
  // =================================================================
  
  console.log("\n=== PERMISSIONS SETUP ===");
  
  // Get contract instances
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", savedAddresses.communityRegistry!);
  const communityDeployer = await ethers.getContractAt("CoreDeployer", savedAddresses.communityDeployer!);
  const workModulesDeployer = await ethers.getContractAt("WorkModulesDeployer", savedAddresses.workModulesDeployer!);
  const communityModulesDeployer = await ethers.getContractAt("CommunityModulesDeployer", savedAddresses.communityModulesDeployer!);
  const communityOrchestrator = await ethers.getContractAt("CommunityOrchestrator", savedAddresses.communityOrchestrator!);

  console.log("\n🔐 Setting up orchestrator permissions...");

  // Grant admin roles to orchestrator on all deployers
  const DEFAULT_ADMIN_ROLE = await communityDeployer.DEFAULT_ADMIN_ROLE();
  
  // CommunityDeployer
  const hasDeployerRole = await communityDeployer.hasRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
  if (!hasDeployerRole) {
    await communityDeployer.grantRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
    console.log("✅ Orchestrator granted admin on CommunityDeployer");
  } else {
    console.log("✅ Orchestrator already has admin on CommunityDeployer");
  }

  // WorkModulesDeployer
  const hasWorkRole = await workModulesDeployer.hasRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
  if (!hasWorkRole) {
    await workModulesDeployer.grantRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
    console.log("✅ Orchestrator granted admin on WorkModulesDeployer");
  } else {
    console.log("✅ Orchestrator already has admin on WorkModulesDeployer");
  }

  // CommunityModulesDeployer
  const hasCommunityRole = await communityModulesDeployer.hasRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
  if (!hasCommunityRole) {
    await communityModulesDeployer.grantRole(DEFAULT_ADMIN_ROLE, savedAddresses.communityOrchestrator);
    console.log("✅ Orchestrator granted admin on CommunityModulesDeployer");
  } else {
    console.log("✅ Orchestrator already has admin on CommunityModulesDeployer");
  }

  // Grant orchestrator permission to create communities in registry
  console.log("\n🔐 Setting up registry permissions...");
  const COMMUNITY_CREATOR_ROLE = await communityRegistry.COMMUNITY_CREATOR_ROLE();
  const hasCreatorRole = await communityRegistry.hasRole(COMMUNITY_CREATOR_ROLE, savedAddresses.communityOrchestrator);
  
  if (!hasCreatorRole) {
    await communityRegistry.grantRole(COMMUNITY_CREATOR_ROLE, savedAddresses.communityOrchestrator);
    console.log("✅ Orchestrator granted COMMUNITY_CREATOR_ROLE");
  } else {
    console.log("✅ Orchestrator already has COMMUNITY_CREATOR_ROLE");
  }

  // =================================================================
  // FINAL SUMMARY
  // =================================================================
  
  console.log("\n🎉 DISTRIBUTED FACTORY DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  
  console.log("\n📋 DEPLOYED CONTRACTS:");
  console.log("├── CommunityRegistry:", savedAddresses.communityRegistry);
  console.log("├── CountingMultiChoice:", savedAddresses.countingMultiChoice);
  console.log("├── CommunityDeployer:", savedAddresses.communityDeployer);
  console.log("├── WorkModulesDeployer:", savedAddresses.workModulesDeployer);
  console.log("├── CommunityModulesDeployer:", savedAddresses.communityModulesDeployer);
  console.log("└── CommunityOrchestrator:", savedAddresses.communityOrchestrator);
  
  console.log("\n🌐 NETWORK INFO:");
  const network = await ethers.provider.getNetwork();
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log("├── Network:", network.name);
  console.log("├── Chain ID:", network.chainId.toString());
  console.log("├── Deployer:", deployer.address);
  console.log("└── Final Balance:", ethers.formatEther(finalBalance));
  
  console.log("\n🚀 NEXT STEPS:");
  console.log("1. Test community creation with new orchestrator");
  console.log("2. Update UI to use CommunityOrchestrator address");
  console.log("3. Migrate existing communities (optional)");
  
  console.log("\n💻 UI INTEGRATION:");
  console.log("Use this address in your frontend:");
  console.log(`const COMMUNITY_ORCHESTRATOR = "${savedAddresses.communityOrchestrator}";`);

  console.log("\n📄 ADDRESSES FOR FRONTEND:");
  console.log(JSON.stringify({
    communityOrchestrator: savedAddresses.communityOrchestrator,
    communityRegistry: savedAddresses.communityRegistry,
    countingMultiChoice: savedAddresses.countingMultiChoice
  }, null, 2));

  return savedAddresses;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});