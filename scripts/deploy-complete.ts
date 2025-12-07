/**
 * Shift DeSoc Complete System Deployment Script
 *
 * This script deploys the entire Shift DeSoc ecosystem in the correct order
 * with proper configuration and integration. This is the single deployment
 * script for fresh deployments on any network.
 *
 * Components deployed:
 * 1. Core Infrastructure (Registry, ParamController)
 * 2. Governance System (Governor, Timelock, Tokens, Multi-Choice Voting)
 * 3. VPT System (VerifierPowerToken, Elections, Manager)
 * 4. Work Verification (ValuableActionRegistry, Claims, ValuableActionSBT, VerifierPool)
 * 5. Economic Layer (CommunityToken, RevenueRouter, TreasuryAdapter)
 * 6. Community Modules (RequestHub, DraftsManager, HousingManager, Marketplace, ProjectFactory)
 * 7. System Integration & Configuration
 */

const hre = require("hardhat");
const { ethers } = hre;

interface DeploymentConfig {
  // Network Configuration
  network: string;

  // Initial Community Parameters
  communityName: string;
  communityDescription: string;

  // Governance Timing (seconds)
  votingDelay: number; // Time before voting starts
  votingPeriod: number; // How long voting lasts
  proposalThreshold: number; // Tokens needed to propose
  executionDelay: number; // Timelock delay before execution

  // VPT Configuration
  verifierPanelSize: number; // Number of verifiers per panel (3-9)
  verifierMin: number; // Minimum approvals needed
  maxPanelsPerEpoch: number; // Max concurrent panels
  useVPTWeighting: boolean; // Whether to use VPT amounts as weights
  maxWeightPerVerifier: number; // Maximum weight per verifier
  cooldownAfterFraud: number; // Cooldown after fraud detection (seconds)
  electionDuration: number; // How long elections run (seconds)
  minVotingPower: number; // Minimum VPT to participate in elections

  // Economic Parameters
  revenueSplit: [number, number, number]; // [workers%, treasury%, investors%]
  feeOnWithdraw: number; // Fee percentage (basis points)
  backingAssets: string[]; // Addresses of approved backing tokens (USDC, etc)

  // Initial Setup
  founderAddress: string; // Address to receive initial governance tokens
  initialMembershipTokens: number; // Initial governance tokens for founder
  initialVPTTokens: number; // Initial VPT tokens for founder
}

// Network-specific configurations
const NETWORK_CONFIGS: { [network: string]: Partial<DeploymentConfig> } = {
  base_sepolia: {
    backingAssets: ["0x036CbD53842c5426634e7929541eC2318f3dCF7e"], // USDC on Base Sepolia
  },
  base: {
    backingAssets: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // USDC on Base
  },
  ethereum_sepolia: {
    backingAssets: ["0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79"], // USDC on Ethereum Sepolia
  },
  ethereum: {
    backingAssets: ["0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79"], // USDC on Ethereum
  },
};

// Default configuration
const DEFAULT_CONFIG: DeploymentConfig = {
  network: "hardhat",

  // Community Setup
  communityName: "Shift DeSoc Community",
  communityDescription:
    "A decentralized cooperative community powered by Shift DeSoc technology",

  // Governance Timing (optimized for Base low costs)
  votingDelay: 7200, // 2 hours
  votingPeriod: 86400, // 1 day
  proposalThreshold: 100, // 100 tokens to propose
  executionDelay: 21600, // 6 hours timelock

  // VPT Configuration (medium community size)
  verifierPanelSize: 5,
  verifierMin: 3,
  maxPanelsPerEpoch: 20,
  useVPTWeighting: true,
  maxWeightPerVerifier: 1000,
  cooldownAfterFraud: 86400, // 1 day
  electionDuration: 259200, // 3 days
  minVotingPower: 100,

  // Economic Parameters
  revenueSplit: [60, 30, 10], // 60% workers, 30% treasury, 10% investors
  feeOnWithdraw: 50, // 0.5% fee
  backingAssets: [], // Will be set per network

  // Initial Setup
  founderAddress: "", // Will be set to deployer
  initialMembershipTokens: 10000,
  initialVPTTokens: 1000,
};

class ShiftDeSocDeployer {
  private contracts: { [name: string]: any } = {};
  private config: DeploymentConfig;
  private deployer: any;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async deploy(): Promise<void> {
    [this.deployer] = await ethers.getSigners();

    console.log(
      `\n🚀 Starting Shift DeSoc Complete Deployment on ${this.config.network}`,
    );
    console.log("=".repeat(70));
    console.log(`Deployer: ${this.deployer.address}`);
    console.log(
      `Balance: ${ethers.formatEther(await ethers.provider.getBalance(this.deployer.address))} ETH`,
    );

    // Set founder address to deployer if not specified
    if (!this.config.founderAddress) {
      this.config.founderAddress = this.deployer.address;
    }

    console.log(`Founder: ${this.config.founderAddress}`);
    console.log(`Community: ${this.config.communityName}`);

    // 1. Deploy Core Infrastructure
    await this.deployCoreInfrastructure();

    // 2. Deploy Governance System
    await this.deployGovernanceSystem();

    // 3. Deploy VPT System
    await this.deployVPTSystem();

    // 4. Deploy Work Verification System
    await this.deployWorkVerificationSystem();

    // 5. Deploy Economic Layer
    await this.deployEconomicLayer();

    // 6. Deploy Community Modules
    await this.deployCommunityModules();

    // 7. Configure System Integration
    await this.configureSystemIntegration();

    // 8. Bootstrap Initial Community
    await this.bootstrapInitialCommunity();

    // 9. Verify Deployment
    await this.verifyDeployment();

    console.log("\n✅ Shift DeSoc deployment completed successfully!");
    this.printDeploymentSummary();
  }

  private async deployCoreInfrastructure(): Promise<void> {
    console.log("\n📋 1. Deploying Core Infrastructure...");

    // Deploy CommunityRegistry
    console.log("   📝 Deploying CommunityRegistry...");
    const CommunityRegistry =
      await ethers.getContractFactory("CommunityRegistry");
    this.contracts.communityRegistry = await CommunityRegistry.deploy();
    await this.contracts.communityRegistry.waitForDeployment();
    console.log(
      `   ✅ CommunityRegistry: ${await this.contracts.communityRegistry.getAddress()}`,
    );

    // Deploy ParamController
    console.log("   ⚙️  Deploying ParamController...");
    const ParamController = await ethers.getContractFactory("ParamController");
    this.contracts.paramController = await ParamController.deploy(
      this.deployer.address,
    );
    await this.contracts.paramController.waitForDeployment();
    console.log(
      `   ✅ ParamController: ${await this.contracts.paramController.getAddress()}`,
    );
  }

  private async deployGovernanceSystem(): Promise<void> {
    console.log("\n🏛️  2. Deploying Governance System...");

    // Deploy MembershipToken
    console.log("   🎫 Deploying MembershipTokenERC20Votes...");
    const MembershipToken = await ethers.getContractFactory(
      "MembershipTokenERC20Votes",
    );
    this.contracts.membershipToken = await MembershipToken.deploy(
      "Shift Membership",
      "sMEM",
    );
    await this.contracts.membershipToken.waitForDeployment();
    console.log(
      `   ✅ MembershipToken: ${await this.contracts.membershipToken.getAddress()}`,
    );

    // Deploy TimelockController
    console.log("   ⏰ Deploying TimelockController...");
    const TimelockController =
      await ethers.getContractFactory("TimelockController");
    this.contracts.timelock = await TimelockController.deploy(
      this.config.executionDelay,
      [], // No initial proposers
      [], // No initial executors
      ethers.ZeroAddress, // No admin (self-administered)
    );
    await this.contracts.timelock.waitForDeployment();
    console.log(
      `   ✅ TimelockController: ${await this.contracts.timelock.getAddress()}`,
    );

    // Deploy ShiftGovernor
    console.log("   🗳️  Deploying ShiftGovernor...");
    const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
    this.contracts.governor = await ShiftGovernor.deploy(
      await this.contracts.membershipToken.getAddress(),
      await this.contracts.timelock.getAddress(),
    );
    await this.contracts.governor.waitForDeployment();
    console.log(
      `   ✅ ShiftGovernor: ${await this.contracts.governor.getAddress()}`,
    );

    // Deploy CountingMultiChoice
    console.log("   🔢 Deploying CountingMultiChoice...");
    const CountingMultiChoice = await ethers.getContractFactory(
      "CountingMultiChoice",
    );
    this.contracts.countingMultiChoice = await CountingMultiChoice.deploy();
    await this.contracts.countingMultiChoice.waitForDeployment();
    console.log(
      `   ✅ CountingMultiChoice: ${await this.contracts.countingMultiChoice.getAddress()}`,
    );

    // Configure governance parameters
    await this.configureGovernance();
  }

  private async deployVPTSystem(): Promise<void> {
    console.log("\n👥 3. Deploying VPT (Verifier Power Token) System...");

    // Deploy VerifierPowerToken1155
    console.log("   🎯 Deploying VerifierPowerToken1155...");
    const VerifierPowerToken1155 = await ethers.getContractFactory(
      "VerifierPowerToken1155",
    );
    this.contracts.verifierPowerToken = await VerifierPowerToken1155.deploy(
      await this.contracts.communityRegistry.getAddress(),
    );
    await this.contracts.verifierPowerToken.waitForDeployment();
    console.log(
      `   ✅ VerifierPowerToken1155: ${await this.contracts.verifierPowerToken.getAddress()}`,
    );

    // Deploy VerifierElection
    console.log("   🗳️  Deploying VerifierElection...");
    const VerifierElection =
      await ethers.getContractFactory("VerifierElection");
    this.contracts.verifierElection = await VerifierElection.deploy(
      await this.contracts.verifierPowerToken.getAddress(),
      this.config.electionDuration,
      3600, // 1 hour timelock delay for elections
    );
    await this.contracts.verifierElection.waitForDeployment();
    console.log(
      `   ✅ VerifierElection: ${await this.contracts.verifierElection.getAddress()}`,
    );

    // Deploy VerifierManager
    console.log("   👨‍💼 Deploying VerifierManager...");
    const VerifierManager = await ethers.getContractFactory("VerifierManager");
    this.contracts.verifierManager = await VerifierManager.deploy(
      await this.contracts.verifierPowerToken.getAddress(),
      await this.contracts.verifierElection.getAddress(),
      await this.contracts.paramController.getAddress(),
    );
    await this.contracts.verifierManager.waitForDeployment();
    console.log(
      `   ✅ VerifierManager: ${await this.contracts.verifierManager.getAddress()}`,
    );

    // Grant manager role to election contract
    const managerRole = await this.contracts.verifierManager.MANAGER_ROLE();
    await this.contracts.verifierManager.grantRole(
      managerRole,
      await this.contracts.verifierElection.getAddress(),
    );
    console.log("   🔑 Granted MANAGER_ROLE to VerifierElection");
  }

  private async deployWorkVerificationSystem(): Promise<void> {
    console.log("\n🔍 4. Deploying Work Verification System...");

    // Deploy ValuableActionRegistry
    console.log("   📋 Deploying ValuableActionRegistry...");
    const ValuableActionRegistry = await ethers.getContractFactory(
      "ValuableActionRegistry",
    );
    this.contracts.valuableActionRegistry = await ValuableActionRegistry.deploy(
      await this.contracts.communityRegistry.getAddress(),
    );
    await this.contracts.valuableActionRegistry.waitForDeployment();
    console.log(
      `   ✅ ValuableActionRegistry: ${await this.contracts.valuableActionRegistry.getAddress()}`,
    );

    // Deploy ValuableActionSBT
    console.log("   🏆 Deploying ValuableActionSBT...");
    const ValuableActionSBT =
      await ethers.getContractFactory("ValuableActionSBT");
    this.contracts.valuableActionSBT = await ValuableActionSBT.deploy(
      await this.contracts.communityRegistry.getAddress(),
    );
    await this.contracts.valuableActionSBT.waitForDeployment();
    console.log(
      `   ✅ ValuableActionSBT: ${await this.contracts.valuableActionSBT.getAddress()}`,
    );

    // Deploy Claims
    console.log("   📝 Deploying Claims...");
    const Claims = await ethers.getContractFactory("Claims");
    this.contracts.claims = await Claims.deploy(
      await this.contracts.verifierManager.getAddress(),
      await this.contracts.paramController.getAddress(),
    );
    await this.contracts.claims.waitForDeployment();
    console.log(`   ✅ Claims: ${await this.contracts.claims.getAddress()}`);
  }

  private async deployEconomicLayer(): Promise<void> {
    console.log("\n💰 5. Deploying Economic Layer...");

    // Deploy CommunityToken
    console.log("   🪙 Deploying CommunityToken...");
    const CommunityToken = await ethers.getContractFactory("CommunityToken");
    this.contracts.communityToken = await CommunityToken.deploy(
      this.config.backingAssets[0], // Primary backing asset (USDC)
      1, // Community ID (will be created in bootstrap step)
      "Shift Community Token", // Token name
      "SCT", // Token symbol
      this.deployer.address, // Treasury (deployer initially)
      ethers.parseEther("1000000"), // Max supply (1M tokens)
      await this.contracts.paramController.getAddress(), // ParamController for fees
    );
    await this.contracts.communityToken.waitForDeployment();
    console.log(
      `   ✅ CommunityToken: ${await this.contracts.communityToken.getAddress()}`,
    );

    // Deploy CohortRegistry
    console.log("   📋 Deploying CohortRegistry...");
    const CohortRegistry = await ethers.getContractFactory("CohortRegistry");
    this.contracts.cohortRegistry = await CohortRegistry.deploy(
      await this.contracts.paramController.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
    );
    await this.contracts.cohortRegistry.waitForDeployment();
    console.log(
      `   ✅ CohortRegistry: ${await this.contracts.cohortRegistry.getAddress()}`,
    );

    // Deploy RevenueRouter with cohort system
    console.log("   📊 Deploying RevenueRouter...");
    const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
    this.contracts.revenueRouter = await RevenueRouter.deploy(
      await this.contracts.paramController.getAddress(),
      await this.contracts.cohortRegistry.getAddress(),
      await this.contracts.communityToken.getAddress(),
    );
    await this.contracts.revenueRouter.waitForDeployment();
    console.log(
      `   ✅ RevenueRouter: ${await this.contracts.revenueRouter.getAddress()}`,
    );

    // Deploy TreasuryAdapter
    console.log("   🏦 Deploying TreasuryAdapter...");
    const TreasuryAdapter = await ethers.getContractFactory("TreasuryAdapter");
    this.contracts.treasuryAdapter = await TreasuryAdapter.deploy(
      await this.contracts.communityRegistry.getAddress(),
      await this.contracts.paramController.getAddress(),
    );
    await this.contracts.treasuryAdapter.waitForDeployment();
    console.log(
      `   ✅ TreasuryAdapter: ${await this.contracts.treasuryAdapter.getAddress()}`,
    );
  }

  private async deployCommunityModules(): Promise<void> {
    console.log("\n🏘️  6. Deploying Community Modules...");

    // Deploy RequestHub
    console.log("   💬 Deploying RequestHub...");
    const RequestHub = await ethers.getContractFactory("RequestHub");
    this.contracts.requestHub = await RequestHub.deploy(
      await this.contracts.communityRegistry.getAddress(),
    );
    await this.contracts.requestHub.waitForDeployment();
    console.log(
      `   ✅ RequestHub: ${await this.contracts.requestHub.getAddress()}`,
    );

    // Deploy DraftsManager
    console.log("   📝 Deploying DraftsManager...");
    const DraftsManager = await ethers.getContractFactory("DraftsManager");
    this.contracts.draftsManager = await DraftsManager.deploy(
      await this.contracts.communityRegistry.getAddress(),
      await this.contracts.requestHub.getAddress(),
    );
    await this.contracts.draftsManager.waitForDeployment();
    console.log(
      `   ✅ DraftsManager: ${await this.contracts.draftsManager.getAddress()}`,
    );

    // Deploy HousingManager
    console.log("   🏠 Deploying HousingManager...");
    const HousingManager = await ethers.getContractFactory("HousingManager");
    this.contracts.housingManager = await HousingManager.deploy(
      await this.contracts.communityRegistry.getAddress(),
      await this.contracts.communityToken.getAddress(),
    );
    await this.contracts.housingManager.waitForDeployment();
    console.log(
      `   ✅ HousingManager: ${await this.contracts.housingManager.getAddress()}`,
    );

    // Deploy Marketplace
    console.log("   🛍️  Deploying Marketplace...");
    const Marketplace = await ethers.getContractFactory("Marketplace");
    this.contracts.marketplace = await Marketplace.deploy(
      await this.contracts.communityRegistry.getAddress(),
      await this.contracts.verifierManager.getAddress(),
    );
    await this.contracts.marketplace.waitForDeployment();
    console.log(
      `   ✅ Marketplace: ${await this.contracts.marketplace.getAddress()}`,
    );

    // Deploy ProjectFactory
    console.log("   🏭 Deploying ProjectFactory...");
    const ProjectFactory = await ethers.getContractFactory("ProjectFactory");
    this.contracts.projectFactory = await ProjectFactory.deploy(
      await this.contracts.communityToken.getAddress(),
      await this.contracts.verifierManager.getAddress(),
    );
    await this.contracts.projectFactory.waitForDeployment();
    console.log(
      `   ✅ ProjectFactory: ${await this.contracts.projectFactory.getAddress()}`,
    );
  }

  private async configureGovernance(): Promise<void> {
    console.log("\n   🔧 Configuring governance parameters...");

    const timelockAddress = await this.contracts.timelock.getAddress();
    const governorAddress = await this.contracts.governor.getAddress();

    // Grant timelock roles to governor
    const proposerRole = await this.contracts.timelock.PROPOSER_ROLE();
    const executorRole = await this.contracts.timelock.EXECUTOR_ROLE();
    const cancellerRole = await this.contracts.timelock.CANCELLER_ROLE();

    await this.contracts.timelock.grantRole(proposerRole, governorAddress);
    await this.contracts.timelock.grantRole(executorRole, governorAddress);
    await this.contracts.timelock.grantRole(cancellerRole, governorAddress);

    console.log("   ✅ Granted timelock roles to governor");
  }

  private async configureSystemIntegration(): Promise<void> {
    console.log("\n🔗 7. Configuring System Integration...");

    // This is where we would register all module addresses in the CommunityRegistry
    // and set up cross-contract permissions and integrations

    console.log("   🔧 Setting up cross-contract integrations...");

    // Configure VPT parameters for initial community (will be community ID 1)
    await this.contracts.paramController.setVerifierParams(
      1, // Community ID (will be created in bootstrap step)
      this.config.verifierPanelSize,
      this.config.verifierMin,
      this.config.maxPanelsPerEpoch,
      this.config.useVPTWeighting,
      this.config.maxWeightPerVerifier,
      this.config.cooldownAfterFraud,
    );
    console.log("   ✅ VPT parameters configured for community 1");

    // Configure revenue policy for initial community
    await this.contracts.paramController.setRevenuePolicy(
      1, // Community ID
      this.config.revenueSplit,
    );
    console.log("   ✅ Revenue policy configured for community 1");

    // Set CohortRegistry in ValuableActionSBT for Investment SBT minting
    await this.contracts.valuableActionSBT.setCohortRegistry(
      await this.contracts.cohortRegistry.getAddress(),
    );
    console.log("   ✅ CohortRegistry set in ValuableActionSBT");

    // Grant necessary roles and permissions
    const minterRole = await this.contracts.membershipToken.MINTER_ROLE();
    await this.contracts.membershipToken.grantRole(
      minterRole,
      await this.contracts.claims.getAddress(),
    );
    console.log("   ✅ Granted MINTER_ROLE to Claims contract");

    // Grant INVESTMENT_MANAGER_ROLE to admin for initial setup
    const investmentManagerRole =
      await this.contracts.cohortRegistry.INVESTMENT_MANAGER_ROLE();
    await this.contracts.cohortRegistry.grantRole(
      investmentManagerRole,
      this.deployer.address,
    );
    console.log("   ✅ Granted INVESTMENT_MANAGER_ROLE to deployer");
  }

  private async bootstrapInitialCommunity(): Promise<void> {
    console.log("\n🌱 8. Bootstrapping Initial Community...");

    // Register the initial community
    console.log("   🏘️  Registering initial community...");
    const communityParams = {
      name: this.config.communityName,
      description: this.config.communityDescription,
      metadataURI: "", // Can be set later via governance

      // Governance parameters
      debateWindow: this.config.votingDelay,
      voteWindow: this.config.votingPeriod,
      executionDelay: this.config.executionDelay,

      // Eligibility rules
      minSeniority: 0, // No minimum seniority for new community
      minSBTs: 0, // No minimum SBTs for new community
      proposalThreshold: this.config.proposalThreshold,

      // Economic parameters
      revenueSplit: this.config.revenueSplit,
      feeOnWithdraw: this.config.feeOnWithdraw,
      backingAssets: this.config.backingAssets,

      // Module addresses
      governor: await this.contracts.governor.getAddress(),
      timelock: await this.contracts.timelock.getAddress(),
      requestHub: await this.contracts.requestHub.getAddress(),
      draftsManager: await this.contracts.draftsManager.getAddress(),
      claimsManager: await this.contracts.claims.getAddress(),
      valuableActionRegistry:
        await this.contracts.valuableActionRegistry.getAddress(),
      verifierPool: await this.contracts.verifierManager.getAddress(), // Using VPT Manager
      valuableActionSBT: await this.contracts.valuableActionSBT.getAddress(),
      treasuryAdapter: await this.contracts.treasuryAdapter.getAddress(),
    };

    await this.contracts.communityRegistry.registerCommunity(communityParams);
    console.log("   ✅ Initial community registered as ID 1");

    // Mint initial governance tokens to founder
    await this.contracts.membershipToken.mint(
      this.config.founderAddress,
      this.config.initialMembershipTokens,
    );
    console.log(
      `   ✅ Minted ${this.config.initialMembershipTokens} governance tokens to founder`,
    );

    // Mint initial VPT tokens to founder
    await this.contracts.verifierPowerToken.mint(
      this.config.founderAddress,
      1, // Community ID 1
      this.config.initialVPTTokens,
      "0x", // No data
    );
    console.log(
      `   ✅ Minted ${this.config.initialVPTTokens} VPT tokens to founder`,
    );

    // Delegate voting power to founder
    await this.contracts.membershipToken
      .connect(await ethers.getSigner(this.config.founderAddress))
      .delegate(this.config.founderAddress);
    console.log("   ✅ Founder delegated voting power to self");
  }

  private async verifyDeployment(): Promise<void> {
    console.log("\n🔍 9. Verifying Deployment...");

    // Test governance token functionality
    const founderBalance = await this.contracts.membershipToken.balanceOf(
      this.config.founderAddress,
    );
    console.log(`   ✅ Founder governance token balance: ${founderBalance}`);

    // Test VPT functionality
    const founderVPTBalance = await this.contracts.verifierPowerToken.balanceOf(
      this.config.founderAddress,
      1,
    );
    console.log(`   ✅ Founder VPT balance: ${founderVPTBalance}`);

    // Test community registration
    const communityCount =
      await this.contracts.communityRegistry.communityCount();
    console.log(`   ✅ Communities registered: ${communityCount}`);

    // Test parameter configuration
    const vptParams = await this.contracts.paramController.getVerifierParams(1);
    console.log(`   ✅ VPT panel size for community 1: ${vptParams[0]}`);

    console.log("   🎉 All verification tests passed!");
  }

  private printDeploymentSummary(): void {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 SHIFT DESOC DEPLOYMENT SUMMARY");
    console.log("=".repeat(70));
    console.log(`Network: ${this.config.network}`);
    console.log(`Deployer: ${this.deployer.address}`);
    console.log(`Community: ${this.config.communityName}`);

    console.log("\n📍 CORE INFRASTRUCTURE:");
    console.log(
      `   CommunityRegistry: ${this.contracts.communityRegistry.target}`,
    );
    console.log(`   ParamController: ${this.contracts.paramController.target}`);

    console.log("\n🏛️  GOVERNANCE SYSTEM:");
    console.log(`   MembershipToken: ${this.contracts.membershipToken.target}`);
    console.log(`   TimelockController: ${this.contracts.timelock.target}`);
    console.log(`   ShiftGovernor: ${this.contracts.governor.target}`);
    console.log(
      `   CountingMultiChoice: ${this.contracts.countingMultiChoice.target}`,
    );

    console.log("\n👥 VPT SYSTEM:");
    console.log(
      `   VerifierPowerToken1155: ${this.contracts.verifierPowerToken.target}`,
    );
    console.log(
      `   VerifierElection: ${this.contracts.verifierElection.target}`,
    );
    console.log(`   VerifierManager: ${this.contracts.verifierManager.target}`);

    console.log("\n🔍 WORK VERIFICATION:");
    console.log(
      `   ValuableActionRegistry: ${this.contracts.valuableActionRegistry.target}`,
    );
    console.log(`   Claims: ${this.contracts.claims.target}`);
    console.log(
      `   ValuableActionSBT: ${this.contracts.valuableActionSBT.target}`,
    );

    console.log("\n💰 ECONOMIC LAYER:");
    console.log(`   CommunityToken: ${this.contracts.communityToken.target}`);
    console.log(`   CohortRegistry: ${this.contracts.cohortRegistry.target}`);
    console.log(`   RevenueRouter: ${this.contracts.revenueRouter.target}`);
    console.log(`   TreasuryAdapter: ${this.contracts.treasuryAdapter.target}`);

    console.log("\n🏘️  COMMUNITY MODULES:");
    console.log(`   RequestHub: ${this.contracts.requestHub.target}`);
    console.log(`   DraftsManager: ${this.contracts.draftsManager.target}`);
    console.log(`   HousingManager: ${this.contracts.housingManager.target}`);
    console.log(`   Marketplace: ${this.contracts.marketplace.target}`);
    console.log(`   ProjectFactory: ${this.contracts.projectFactory.target}`);

    console.log("\n⚙️  SYSTEM CONFIGURATION:");
    console.log(
      `   Governance tokens: ${this.config.initialMembershipTokens} (to founder)`,
    );
    console.log(`   VPT tokens: ${this.config.initialVPTTokens} (to founder)`);
    console.log(
      `   Revenue split: ${this.config.revenueSplit.join("/")} (workers/treasury/investors)`,
    );
    console.log(
      `   Verifier panel: ${this.config.verifierPanelSize} members, ${this.config.verifierMin} minimum approvals`,
    );

    console.log("\n🚀 NEXT STEPS:");
    console.log("   1. Update frontend with deployed contract addresses");
    console.log("   2. Create initial ValuableActions via governance");
    console.log("   3. Create investment cohorts for community funding");
    console.log("   4. Set up verifier elections for community");
    console.log("   5. Configure community-specific parameters");
    console.log("   6. Begin community onboarding and operations");

    console.log("\n💡 MANAGEMENT COMMANDS:");
    console.log("   npm run status              # Check system status");
    console.log("   npm run manage elections    # Manage verifier elections");
    console.log("   npm run manage governance   # Governance operations");
    console.log("   npm run manage cohorts      # Manage investment cohorts");
    console.log("   npm run manage claims       # Claims and verification");
  }
}

// Main deployment function
async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "hardhat";
  console.log(`\n🌐 Deploying to network: ${networkName}`);

  // Build configuration
  let config: DeploymentConfig = { ...DEFAULT_CONFIG };
  config.network = networkName;

  // Apply network-specific overrides
  const networkOverrides = NETWORK_CONFIGS[networkName];
  if (networkOverrides) {
    Object.assign(config, networkOverrides);
  }

  // Apply environment overrides
  if (process.env.COMMUNITY_NAME) {
    config.communityName = process.env.COMMUNITY_NAME;
  }
  if (process.env.FOUNDER_ADDRESS) {
    config.founderAddress = process.env.FOUNDER_ADDRESS;
  }

  console.log(
    `Using configuration: ${config.communityName} on ${config.network}`,
  );

  // Deploy the complete system
  const deployer = new ShiftDeSocDeployer(config);
  await deployer.deploy();

  console.log(`\n🎉 Shift DeSoc successfully deployed to ${networkName}!`);
}

// Export for programmatic use
export {
  ShiftDeSocDeployer,
  type DeploymentConfig,
  NETWORK_CONFIGS,
  DEFAULT_CONFIG,
};

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}
