import { ethers } from "hardhat";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Deploy Master Infrastructure with Address Persistence
 * 
 * This script saves deployed contract addresses and reuses them if deployment fails.
 */

interface DeployedAddresses {
  deployer?: string;
  communityRegistry?: string;
  countingMultiChoice?: string;
  tempToken?: string;
  tempTimelock?: string;
  governorTemplate?: string;
  timelockTemplate?: string;
  membershipTokenTemplate?: string;
  valuableActionRegistryTemplate?: string;
  claimsTemplate?: string;
  requestHubTemplate?: string;
  draftsManagerTemplate?: string;
  communityTokenTemplate?: string;
  workerSBTTemplate?: string;
  verifierPoolTemplate?: string;
  treasuryAdapterTemplate?: string;
  communityFactory?: string;
}

const ADDRESSES_FILE = join(__dirname, "deployed-addresses.json");

function saveAddresses(addresses: DeployedAddresses): void {
  writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
  console.log(`📁 Addresses saved to ${ADDRESSES_FILE}`);
}

function loadAddresses(): DeployedAddresses {
  if (existsSync(ADDRESSES_FILE)) {
    const content = readFileSync(ADDRESSES_FILE, "utf8");
    return JSON.parse(content);
  }
  return {};
}

async function deployOrReuse(
  contractName: string,
  factory: any,
  args: any[],
  existingAddress?: string,
  savedAddresses?: DeployedAddresses
): Promise<{ address: string; contract: any }> {
  
  if (existingAddress) {
    console.log(`♻️  Reusing existing ${contractName} at: ${existingAddress}`);
    return {
      address: existingAddress,
      contract: await ethers.getContractAt(contractName, existingAddress)
    };
  }

  console.log(`🚀 Deploying ${contractName}...`);
  try {
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`✅ ${contractName} deployed to: ${address}`);
    
    // Save immediately after successful deployment
    if (savedAddresses) {
      saveAddresses(savedAddresses);
    }
    
    return { address, contract };
  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    throw error;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Shift DeSoc Master Infrastructure...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Load existing addresses
  const savedAddresses = loadAddresses();
  console.log("📁 Loaded existing addresses:", Object.keys(savedAddresses).length, "contracts");

  // External contracts (already deployed)
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  // Update deployer
  savedAddresses.deployer = deployer.address;

  // =================================================================
  // STEP 1: Deploy Shared Infrastructure
  // =================================================================
  
  console.log("\n=== SHARED INFRASTRUCTURE ===");
  
  // Deploy CommunityRegistry
  console.log("\n🌐 Deploying CommunityRegistry...");
  const CommunityRegistry = await ethers.getContractFactory("CommunityRegistry");
  const { address: communityRegistryAddress } = await deployOrReuse(
    "CommunityRegistry",
    CommunityRegistry,
    [deployer.address],
    savedAddresses.communityRegistry,
    { ...savedAddresses, communityRegistry: "DEPLOYING" }
  );
  savedAddresses.communityRegistry = communityRegistryAddress;
  saveAddresses(savedAddresses);

  // Deploy CountingMultiChoice
  console.log("\n🗳️ Deploying CountingMultiChoice...");
  const CountingMultiChoice = await ethers.getContractFactory("CountingMultiChoice");
  const { address: countingMultiChoiceAddress } = await deployOrReuse(
    "CountingMultiChoice",
    CountingMultiChoice,
    [],
    savedAddresses.countingMultiChoice,
    { ...savedAddresses, countingMultiChoice: "DEPLOYING" }
  );
  savedAddresses.countingMultiChoice = countingMultiChoiceAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 2: Deploy Template Dependencies
  // =================================================================
  
  console.log("\n=== TEMPLATE DEPENDENCIES ===");

  // Deploy temporary MembershipToken for templates
  console.log("\n🪙 Deploying temporary MembershipToken...");
  const TempToken = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const { address: tempTokenAddress } = await deployOrReuse(
    "MembershipTokenERC20Votes",
    TempToken,
    ["Template Token", "TMPL", 1, deployer.address],
    savedAddresses.tempToken,
    { ...savedAddresses, tempToken: "DEPLOYING" }
  );
  savedAddresses.tempToken = tempTokenAddress;
  saveAddresses(savedAddresses);

  // Deploy temporary Timelock for templates
  console.log("\n⏰ Deploying temporary TimelockController...");
  const TempTimelock = await ethers.getContractFactory("TimelockController");
  const { address: tempTimelockAddress } = await deployOrReuse(
    "TimelockController",
    TempTimelock,
    [3600, [], [], deployer.address],
    savedAddresses.tempTimelock,
    { ...savedAddresses, tempTimelock: "DEPLOYING" }
  );
  savedAddresses.tempTimelock = tempTimelockAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 3: Deploy Template Contracts
  // =================================================================
  
  console.log("\n=== TEMPLATE CONTRACTS ===");

  // Template 0: ShiftGovernor
  console.log("\n🏛️ Deploying ShiftGovernor template...");
  const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
  const { address: governorTemplateAddress } = await deployOrReuse(
    "ShiftGovernor",
    ShiftGovernor,
    [tempTokenAddress, tempTimelockAddress],
    savedAddresses.governorTemplate,
    { ...savedAddresses, governorTemplate: "DEPLOYING" }
  );
  savedAddresses.governorTemplate = governorTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 1: TimelockController
  console.log("\n⏰ Deploying TimelockController template...");
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const { address: timelockTemplateAddress } = await deployOrReuse(
    "TimelockController",
    TimelockController,
    [3600, [], [], deployer.address],
    savedAddresses.timelockTemplate,
    { ...savedAddresses, timelockTemplate: "DEPLOYING" }
  );
  savedAddresses.timelockTemplate = timelockTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 2: MembershipTokenERC20Votes
  console.log("\n🪙 Deploying MembershipToken template...");
  const MembershipToken = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const { address: membershipTokenTemplateAddress } = await deployOrReuse(
    "MembershipTokenERC20Votes",
    MembershipToken,
    ["Template", "TPL", 1, deployer.address],
    savedAddresses.membershipTokenTemplate,
    { ...savedAddresses, membershipTokenTemplate: "DEPLOYING" }
  );
  savedAddresses.membershipTokenTemplate = membershipTokenTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 3: ValuableActionRegistry
  console.log("\n⚙️ Deploying ValuableActionRegistry template...");
  const ValuableActionRegistry = await ethers.getContractFactory("ValuableActionRegistry");
  const { address: valuableActionRegistryTemplateAddress } = await deployOrReuse(
    "ValuableActionRegistry",
    ValuableActionRegistry,
    [deployer.address],
    savedAddresses.valuableActionRegistryTemplate,
    { ...savedAddresses, valuableActionRegistryTemplate: "DEPLOYING" }
  );
  savedAddresses.valuableActionRegistryTemplate = valuableActionRegistryTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 4: Claims
  console.log("\n✅ Deploying Claims template...");
  const Claims = await ethers.getContractFactory("Claims");
  const { address: claimsTemplateAddress } = await deployOrReuse(
    "Claims",
    Claims,
    [deployer.address, valuableActionRegistryTemplateAddress, deployer.address, deployer.address, tempTokenAddress],
    savedAddresses.claimsTemplate,
    { ...savedAddresses, claimsTemplate: "DEPLOYING" }
  );
  savedAddresses.claimsTemplate = claimsTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 5: RequestHub
  console.log("\n💬 Deploying RequestHub template...");
  const RequestHub = await ethers.getContractFactory("RequestHub");
  const { address: requestHubTemplateAddress } = await deployOrReuse(
    "RequestHub",
    RequestHub,
    [communityRegistryAddress],
    savedAddresses.requestHubTemplate,
    { ...savedAddresses, requestHubTemplate: "DEPLOYING" }
  );
  savedAddresses.requestHubTemplate = requestHubTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 6: DraftsManager
  console.log("\n📝 Deploying DraftsManager template...");
  const DraftsManager = await ethers.getContractFactory("DraftsManager");
  const { address: draftsManagerTemplateAddress } = await deployOrReuse(
    "DraftsManager",
    DraftsManager,
    [communityRegistryAddress, governorTemplateAddress],
    savedAddresses.draftsManagerTemplate,
    { ...savedAddresses, draftsManagerTemplate: "DEPLOYING" }
  );
  savedAddresses.draftsManagerTemplate = draftsManagerTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 7: CommunityToken
  console.log("\n💰 Deploying CommunityToken template...");
  const CommunityToken = await ethers.getContractFactory("CommunityToken");
  const { address: communityTokenTemplateAddress } = await deployOrReuse(
    "CommunityToken",
    CommunityToken,
    [USDC_BASE_SEPOLIA, 1, "Community Token Template", "CTT", deployer.address, ethers.parseEther("1000000")],
    savedAddresses.communityTokenTemplate,
    { ...savedAddresses, communityTokenTemplate: "DEPLOYING" }
  );
  savedAddresses.communityTokenTemplate = communityTokenTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 8: WorkerSBT
  console.log("\n🎖️ Deploying WorkerSBT template...");
  const WorkerSBT = await ethers.getContractFactory("WorkerSBT");
  const { address: workerSBTTemplateAddress } = await deployOrReuse(
    "WorkerSBT",
    WorkerSBT,
    [deployer.address, deployer.address, deployer.address], // initialOwner, manager, governance
    savedAddresses.workerSBTTemplate,
    { ...savedAddresses, workerSBTTemplate: "DEPLOYING" }
  );
  savedAddresses.workerSBTTemplate = workerSBTTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 9: VerifierPool
  console.log("\n👥 Deploying VerifierPool template...");
  const VerifierPool = await ethers.getContractFactory("VerifierPool");
  const { address: verifierPoolTemplateAddress } = await deployOrReuse(
    "VerifierPool",
    VerifierPool,
    [deployer.address],
    savedAddresses.verifierPoolTemplate,
    { ...savedAddresses, verifierPoolTemplate: "DEPLOYING" }
  );
  savedAddresses.verifierPoolTemplate = verifierPoolTemplateAddress;
  saveAddresses(savedAddresses);

  // Template 10: TreasuryAdapter
  console.log("\n🏦 Deploying TreasuryAdapter template...");
  const TreasuryAdapter = await ethers.getContractFactory("TreasuryAdapter");
  const { address: treasuryAdapterTemplateAddress } = await deployOrReuse(
    "TreasuryAdapter",
    TreasuryAdapter,
    [], // No constructor parameters needed
    savedAddresses.treasuryAdapterTemplate,
    { ...savedAddresses, treasuryAdapterTemplate: "DEPLOYING" }
  );
  savedAddresses.treasuryAdapterTemplate = treasuryAdapterTemplateAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 4: Deploy CommunityFactory with all templates
  // =================================================================
  
  console.log("\n=== COMMUNITY FACTORY ===");
  
  // Prepare template addresses array
  const templates = [
    governorTemplateAddress,
    timelockTemplateAddress,
    membershipTokenTemplateAddress,
    valuableActionRegistryTemplateAddress,
    claimsTemplateAddress,
    requestHubTemplateAddress,
    draftsManagerTemplateAddress,
    communityTokenTemplateAddress,
    workerSBTTemplateAddress,
    verifierPoolTemplateAddress,
    treasuryAdapterTemplateAddress
  ];

  console.log("\n🏭 Deploying CommunityFactory...");
  const CommunityFactory = await ethers.getContractFactory("CommunityFactory");
  const { address: communityFactoryAddress } = await deployOrReuse(
    "CommunityFactory",
    CommunityFactory,
    [communityRegistryAddress, countingMultiChoiceAddress, templates],
    savedAddresses.communityFactory,
    { ...savedAddresses, communityFactory: "DEPLOYING" }
  );
  savedAddresses.communityFactory = communityFactoryAddress;
  saveAddresses(savedAddresses);

  // =================================================================
  // STEP 5: Setup Permissions
  // =================================================================
  
  console.log("\n=== PERMISSIONS SETUP ===");
  
  // Grant factory permission to create communities in registry
  console.log("\n🔐 Granting factory permissions...");
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", communityRegistryAddress);
  const hasRole = await communityRegistry.hasRole(
    await communityRegistry.COMMUNITY_CREATOR_ROLE(),
    communityFactoryAddress
  );
  
  if (!hasRole) {
    await communityRegistry.grantRole(
      await communityRegistry.COMMUNITY_CREATOR_ROLE(),
      communityFactoryAddress
    );
    console.log("✅ Factory granted COMMUNITY_CREATOR_ROLE");
  } else {
    console.log("✅ Factory already has COMMUNITY_CREATOR_ROLE");
  }

  // =================================================================
  // DEPLOYMENT SUMMARY
  // =================================================================
  
  console.log("\n🎯 MASTER INFRASTRUCTURE DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("Final Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  
  console.log("\n📋 SHARED CONTRACTS:");
  console.log("├── CommunityRegistry:", communityRegistryAddress);
  console.log("├── CountingMultiChoice:", countingMultiChoiceAddress);
  console.log("└── CommunityFactory:", communityFactoryAddress);
  
  console.log("\n🎨 TEMPLATE CONTRACTS:");
  console.log("├── Governor Template:", governorTemplateAddress);
  console.log("├── Timelock Template:", timelockTemplateAddress); 
  console.log("├── MembershipToken Template:", membershipTokenTemplateAddress);
  console.log("├── ValuableActionRegistry Template:", valuableActionRegistryTemplateAddress);
  console.log("├── Claims Template:", claimsTemplateAddress);
  console.log("├── RequestHub Template:", requestHubTemplateAddress);
  console.log("├── DraftsManager Template:", draftsManagerTemplateAddress);
  console.log("├── CommunityToken Template:", communityTokenTemplateAddress);
  console.log("├── WorkerSBT Template:", workerSBTTemplateAddress);
  console.log("├── VerifierPool Template:", verifierPoolTemplateAddress);
  console.log("└── TreasuryAdapter Template:", treasuryAdapterTemplateAddress);

  console.log("\n🌐 EXTERNAL CONTRACTS:");
  console.log("├── USDC (Base Sepolia):", USDC_BASE_SEPOLIA);
  console.log("└── Multicall3: 0xcA11bde05977b3631167028862bE2a173976CA11");

  console.log("\n📋 NEXT STEPS:");
  console.log("=".repeat(40));
  console.log("1. ✅ Master infrastructure deployed successfully!");
  console.log("2. 🏠 Ready to create communities via CommunityFactory");
  console.log("3. 👤 Update create-community.ts with these addresses:");
  console.log(`   - COMMUNITY_FACTORY_ADDRESS: "${communityFactoryAddress}"`);
  console.log(`   - COMMUNITY_REGISTRY_ADDRESS: "${communityRegistryAddress}"`);
  console.log("4. 🌐 Verify contracts on Base Sepolia block explorer");
  
  console.log("\n📁 All addresses saved to:", ADDRESSES_FILE);
  
  // Final save
  saveAddresses(savedAddresses);

  return {
    communityRegistry: communityRegistryAddress,
    communityFactory: communityFactoryAddress,
    countingMultiChoice: countingMultiChoiceAddress,
    templates
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});