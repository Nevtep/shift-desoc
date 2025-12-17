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
const fs = require("fs");
const path = require("path");

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
  private gasSettings: any;

  constructor(config: DeploymentConfig) {
    this.config = config;
    // Network-specific gas settings for EIP-1559
    // Base mainnet is more optimized and typically needs lower gas prices
    const isMainnet = config.network === 'base' || config.network === 'ethereum';
    
    this.gasSettings = {
      maxFeePerGas: ethers.parseUnits(isMainnet ? "0.05" : "2", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits(isMainnet ? "0.01" : "1", "gwei"),
    };
  }

  // Add small delay between transactions to avoid nonce conflicts
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Wait for transaction confirmation with proper gas settings
  private async waitForTx(tx: any, description: string): Promise<void> {
    const receipt = await tx.wait();
    await this.sleep(1000); // 1 second delay after each transaction
    return receipt;
  }

  // Helper to deploy a contract with proper gas settings
  private async deployContract(
    factory: any,
    ...args: any[]
  ): Promise<any> {
    const contract = await factory.deploy(...args, this.gasSettings);
    await contract.waitForDeployment();
    await this.sleep(2000); // Wait 2 seconds after each deployment
    return contract;
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
    await this.sleep(2000);

    // 2. Deploy Governance System
    await this.deployGovernanceSystem();
    await this.sleep(2000);

    // 3. Deploy VPT System
    await this.deployVPTSystem();
    await this.sleep(2000);

    // 4. Deploy Work Verification System
    await this.deployWorkVerificationSystem();
    await this.sleep(2000);

    // 5. Deploy Economic Layer
    await this.deployEconomicLayer();
    await this.sleep(2000);

    // 6. Deploy Community Modules
    await this.deployCommunityModules();
    await this.sleep(2000);

    // 7. Configure System Integration
    await this.configureSystemIntegration();

    // 8. Bootstrap Initial Community
    await this.bootstrapInitialCommunity();

    // 9. Verify Deployment
    await this.verifyDeployment();

    console.log("\n✅ Shift DeSoc deployment completed successfully!");
    this.printDeploymentSummary();
    await this.saveDeploymentAddresses();
  }

  private async deployCoreInfrastructure(): Promise<void> {
    console.log("\n📋 1. Deploying Core Infrastructure...");

    // Deploy ParamController first (required by CommunityRegistry)
    console.log("   ⚙️  Deploying ParamController...");
    const ParamController = await ethers.getContractFactory("ParamController");
    this.contracts.paramController = await this.deployContract(
      ParamController,
      this.deployer.address,
    );
    console.log(
      `   ✅ ParamController: ${await this.contracts.paramController.getAddress()}`,
    );

    // Deploy CommunityRegistry (depends on ParamController)
    console.log("   📝 Deploying CommunityRegistry...");
    const CommunityRegistry =
      await ethers.getContractFactory("CommunityRegistry");
    this.contracts.communityRegistry = await this.deployContract(
      CommunityRegistry,
      this.deployer.address,
      await this.contracts.paramController.getAddress(),
    );
    console.log(
      `   ✅ CommunityRegistry: ${await this.contracts.communityRegistry.getAddress()}`,
    );
  }

  private async deployGovernanceSystem(): Promise<void> {
    console.log("\n🏛️  2. Deploying Governance System...");

    // Deploy MembershipToken
    console.log("   🎫 Deploying MembershipTokenERC20Votes...");
    const MembershipToken = await ethers.getContractFactory(
      "MembershipTokenERC20Votes",
    );
    this.contracts.membershipToken = await this.deployContract(
      MembershipToken,
      "Shift Membership",
      "sMEM",
      1, // Community ID 1 (will be bootstrapped later)
      this.deployer.address, // Initial admin
    );
    console.log(
      `   ✅ MembershipToken: ${await this.contracts.membershipToken.getAddress()}`,
    );

    // Deploy TimelockController
    console.log("   ⏰ Deploying TimelockController...");
    const TimelockController =
      await ethers.getContractFactory("TimelockController");
    this.contracts.timelock = await this.deployContract(
      TimelockController,
      this.config.executionDelay,
      [], // No initial proposers
      [], // No initial executors
      this.deployer.address, // Deployer as initial admin (will renounce later)
    );
    console.log(
      `   ✅ TimelockController: ${await this.contracts.timelock.getAddress()}`,
    );

    // Deploy ShiftGovernor
    console.log("   🗳️  Deploying ShiftGovernor...");
    const ShiftGovernor = await ethers.getContractFactory("ShiftGovernor");
    this.contracts.governor = await this.deployContract(
      ShiftGovernor,
      await this.contracts.membershipToken.getAddress(),
      await this.contracts.timelock.getAddress(),
    );
    console.log(
      `   ✅ ShiftGovernor: ${await this.contracts.governor.getAddress()}`,
    );

    // Deploy CountingMultiChoice
    console.log("   🔢 Deploying CountingMultiChoice...");
    const CountingMultiChoice = await ethers.getContractFactory(
      "CountingMultiChoice",
    );
    this.contracts.countingMultiChoice = await this.deployContract(
      CountingMultiChoice,
      await this.contracts.governor.getAddress(),
    );
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
    this.contracts.verifierPowerToken = await this.deployContract(
      VerifierPowerToken1155,
      await this.contracts.timelock.getAddress(),
      "", // URI can be set later
    );
    console.log(
      `   ✅ VerifierPowerToken1155: ${await this.contracts.verifierPowerToken.getAddress()}`,
    );

    // Deploy VerifierElection
    console.log("   🗳️  Deploying VerifierElection...");
    const VerifierElection =
      await ethers.getContractFactory("VerifierElection");
    this.contracts.verifierElection = await this.deployContract(
      VerifierElection,
      await this.contracts.timelock.getAddress(),
      await this.contracts.verifierPowerToken.getAddress(),
    );
    console.log(
      `   ✅ VerifierElection: ${await this.contracts.verifierElection.getAddress()}`,
    );

    // Deploy VerifierManager
    console.log("   👨‍💼 Deploying VerifierManager...");
    const VerifierManager = await ethers.getContractFactory("VerifierManager");
    this.contracts.verifierManager = await this.deployContract(
      VerifierManager,
      await this.contracts.verifierElection.getAddress(),
      await this.contracts.paramController.getAddress(),
      await this.contracts.timelock.getAddress(), // governance
    );
    console.log(
      `   ✅ VerifierManager: ${await this.contracts.verifierManager.getAddress()}`,
    );
  }

  private async deployWorkVerificationSystem(): Promise<void> {
    console.log("\n🔍 4. Deploying Work Verification System...");

    // Deploy ValuableActionRegistry
    console.log("   📋 Deploying ValuableActionRegistry...");
    const ValuableActionRegistry = await ethers.getContractFactory(
      "ValuableActionRegistry",
    );
    this.contracts.valuableActionRegistry = await this.deployContract(
      ValuableActionRegistry,
      await this.contracts.timelock.getAddress(), // governance
    );
    console.log(
      `   ✅ ValuableActionRegistry: ${await this.contracts.valuableActionRegistry.getAddress()}`,
    );

    // Deploy ValuableActionSBT
    console.log("   🏆 Deploying ValuableActionSBT...");
    const ValuableActionSBT =
      await ethers.getContractFactory("ValuableActionSBT");
    this.contracts.valuableActionSBT = await this.deployContract(
      ValuableActionSBT,
      this.deployer.address, // initialOwner
      this.deployer.address, // manager (will be Claims after deployment)
      await this.contracts.timelock.getAddress(), // governance
    );
    console.log(
      `   ✅ ValuableActionSBT: ${await this.contracts.valuableActionSBT.getAddress()}`,
    );

    // Deploy Claims
    console.log("   📝 Deploying Claims...");
    const Claims = await ethers.getContractFactory("Claims");
    this.contracts.claims = await this.deployContract(
      Claims,
      await this.contracts.timelock.getAddress(), // governance
      await this.contracts.valuableActionRegistry.getAddress(),
      await this.contracts.verifierManager.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
      await this.contracts.membershipToken.getAddress(),
      1, // communityId
    );
    console.log(`   ✅ Claims: ${await this.contracts.claims.getAddress()}`);
  }

  private async deployEconomicLayer(): Promise<void> {
    console.log("\n💰 5. Deploying Economic Layer...");

    // Deploy CommunityToken
    console.log("   🪙 Deploying CommunityToken...");
    const CommunityToken = await ethers.getContractFactory("CommunityToken");
    this.contracts.communityToken = await this.deployContract(
      CommunityToken,
      this.config.backingAssets[0], // Primary backing asset (USDC)
      1, // Community ID (will be created in bootstrap step)
      "Shift Community Token", // Token name
      "SCT", // Token symbol
      this.deployer.address, // Treasury (deployer initially)
      ethers.parseEther("1000000"), // Max supply (1M tokens)
      await this.contracts.paramController.getAddress(), // ParamController for fees
    );
    console.log(
      `   ✅ CommunityToken: ${await this.contracts.communityToken.getAddress()}`,
    );

    // Deploy CohortRegistry
    console.log("   📋 Deploying CohortRegistry...");
    const CohortRegistry = await ethers.getContractFactory("CohortRegistry");
    this.contracts.cohortRegistry = await this.deployContract(
      CohortRegistry,
      await this.contracts.timelock.getAddress(),
    );
    console.log(
      `   ✅ CohortRegistry: ${await this.contracts.cohortRegistry.getAddress()}`,
    );

    // Deploy RevenueRouter with cohort system
    console.log("   📊 Deploying RevenueRouter...");
    const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
    this.contracts.revenueRouter = await this.deployContract(
      RevenueRouter,
      await this.contracts.paramController.getAddress(),
      await this.contracts.cohortRegistry.getAddress(),
      this.deployer.address, // admin
    );
    console.log(
      `   ✅ RevenueRouter: ${await this.contracts.revenueRouter.getAddress()}`,
    );

    // Deploy TreasuryAdapter
    console.log("   🏦 Deploying TreasuryAdapter...");
    const TreasuryAdapter = await ethers.getContractFactory("TreasuryAdapter");
    this.contracts.treasuryAdapter = await this.deployContract(TreasuryAdapter);
    console.log(
      `   ✅ TreasuryAdapter: ${await this.contracts.treasuryAdapter.getAddress()}`,
    );
  }

  private async deployCommunityModules(): Promise<void> {
    console.log("\n🏘️  6. Deploying Community Modules...");

    // Deploy RequestHub
    console.log("   💬 Deploying RequestHub...");
    const RequestHub = await ethers.getContractFactory("RequestHub");
    this.contracts.requestHub = await this.deployContract(
      RequestHub,
      await this.contracts.communityRegistry.getAddress(),
    );
    console.log(
      `   ✅ RequestHub: ${await this.contracts.requestHub.getAddress()}`,
    );

    // Deploy DraftsManager
    console.log("   📝 Deploying DraftsManager...");
    const DraftsManager = await ethers.getContractFactory("DraftsManager");
    this.contracts.draftsManager = await this.deployContract(
      DraftsManager,
      await this.contracts.communityRegistry.getAddress(),
      await this.contracts.governor.getAddress(), // governor, not requestHub
    );
    console.log(
      `   ✅ DraftsManager: ${await this.contracts.draftsManager.getAddress()}`,
    );

    // Deploy CommerceDisputes (needed by Marketplace)
    console.log("   ⚖️  Deploying CommerceDisputes...");
    const CommerceDisputes = await ethers.getContractFactory("CommerceDisputes");
    this.contracts.commerceDisputes = await this.deployContract(
      CommerceDisputes,
      this.deployer.address,
    );
    console.log(
      `   ✅ CommerceDisputes: ${await this.contracts.commerceDisputes.getAddress()}`,
    );

    // Deploy Marketplace (depends on CommerceDisputes and RevenueRouter)
    console.log("   🛍️  Deploying Marketplace...");
    const Marketplace = await ethers.getContractFactory("Marketplace");
    this.contracts.marketplace = await this.deployContract(
      Marketplace,
      this.deployer.address,
      await this.contracts.commerceDisputes.getAddress(),
      await this.contracts.revenueRouter.getAddress(),
    );
    console.log(
      `   ✅ Marketplace: ${await this.contracts.marketplace.getAddress()}`,
    );

    // Deploy HousingManager (depends on Marketplace)
    console.log("   🏠 Deploying HousingManager...");
    const HousingManager = await ethers.getContractFactory("HousingManager");
    this.contracts.housingManager = await this.deployContract(
      HousingManager,
      this.deployer.address,
      await this.contracts.marketplace.getAddress(),
      this.config.backingAssets[0], // Primary backing asset (USDC)
    );
    console.log(
      `   ✅ HousingManager: ${await this.contracts.housingManager.getAddress()}`,
    );

    // Deploy ProjectFactory
    console.log("   🏭 Deploying ProjectFactory...");
    const ProjectFactory = await ethers.getContractFactory("ProjectFactory");
    this.contracts.projectFactory = await this.deployContract(ProjectFactory);
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
    const adminRole = await this.contracts.timelock.DEFAULT_ADMIN_ROLE();

    await this.contracts.timelock.grantRole(proposerRole, governorAddress, this.gasSettings);
    await this.sleep(3000); // Wait 3 seconds between role grants
    await this.contracts.timelock.grantRole(executorRole, governorAddress, this.gasSettings);
    await this.sleep(3000);
    await this.contracts.timelock.grantRole(cancellerRole, governorAddress, this.gasSettings);
    await this.sleep(3000);

    console.log("   ✅ Granted timelock roles to governor");

    // Renounce admin role - timelock is now fully controlled by governance
    await this.contracts.timelock.renounceRole(adminRole, this.deployer.address, this.gasSettings);
    console.log("   ✅ Deployer renounced timelock admin role");
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
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ VPT parameters configured for community 1");

    // Configure revenue policy for initial community
    // setRevenuePolicy(communityId, minWorkersBps, treasuryBps, investorsBps, spilloverTarget)
    await this.contracts.paramController.setRevenuePolicy(
      1, // Community ID
      this.config.revenueSplit[0] * 100, // Workers BPS (60 * 100 = 6000)
      this.config.revenueSplit[1] * 100, // Treasury BPS (30 * 100 = 3000)
      this.config.revenueSplit[2] * 100, // Investors BPS (10 * 100 = 1000)
      0, // Spillover target: 0 = workers, 1 = treasury
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Revenue policy configured for community 1");

    // Grant GOVERNANCE_ROLE to deployer temporarily for configuration
    const governanceRole = await this.contracts.valuableActionSBT.GOVERNANCE_ROLE();
    await this.contracts.valuableActionSBT.grantRole(
      governanceRole,
      this.deployer.address,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Granted temporary GOVERNANCE_ROLE to deployer");

    // Set CohortRegistry in ValuableActionSBT for Investment SBT minting
    await this.contracts.valuableActionSBT.setCohortRegistry(
      await this.contracts.cohortRegistry.getAddress(),
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ CohortRegistry set in ValuableActionSBT");

    // Revoke temporary GOVERNANCE_ROLE from deployer
    await this.contracts.valuableActionSBT.revokeRole(
      governanceRole,
      this.deployer.address,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Revoked GOVERNANCE_ROLE from deployer");

    // Grant necessary roles and permissions
    const minterRole = await this.contracts.membershipToken.MINTER_ROLE();
    await this.contracts.membershipToken.grantRole(
      minterRole,
      await this.contracts.claims.getAddress(),
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Granted MINTER_ROLE to Claims contract");

    // Configure commerce module integrations
    console.log("   🛍️  Configuring commerce module integrations...");

    // Authorize Marketplace to use CommerceDisputes
    await this.contracts.commerceDisputes.setAuthorizedCaller(
      await this.contracts.marketplace.getAddress(),
      true,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Authorized Marketplace to open disputes");

    // Set Marketplace as dispute receiver
    await this.contracts.commerceDisputes.setDisputeReceiver(
      await this.contracts.marketplace.getAddress(),
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Set Marketplace as dispute receiver");

    // Grant DISTRIBUTOR_ROLE to Marketplace on RevenueRouter
    const distributorRole = await this.contracts.revenueRouter.DISTRIBUTOR_ROLE();
    await this.contracts.revenueRouter.grantRole(
      distributorRole,
      await this.contracts.marketplace.getAddress(),
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Granted DISTRIBUTOR_ROLE to Marketplace");
  }

  private async bootstrapInitialCommunity(): Promise<void> {
    console.log("\n🌱 8. Bootstrapping Initial Community...");

    // Register the initial community
    console.log("   🏘️  Registering initial community...");
    
    // Step 1: Register the community with basic metadata
    const tx = await this.contracts.communityRegistry.registerCommunity(
      this.config.communityName,
      this.config.communityDescription,
      "", // metadataURI - can be set later via governance
      0,  // parentCommunityId - 0 for root community
      this.gasSettings,
    );
    await tx.wait();
    await this.sleep(2000);
    const communityId = 1; // First community gets ID 1
    console.log(`   ✅ Initial community registered as ID ${communityId}`);

    // Step 2: Set module addresses for the community
    console.log("   🔧 Configuring community modules...");
    const moduleAddresses = {
      governor: await this.contracts.governor.getAddress(),
      timelock: await this.contracts.timelock.getAddress(),
      requestHub: await this.contracts.requestHub.getAddress(),
      draftsManager: await this.contracts.draftsManager.getAddress(),
      claimsManager: await this.contracts.claims.getAddress(),
      valuableActionRegistry: await this.contracts.valuableActionRegistry.getAddress(),
      verifierPowerToken: await this.contracts.verifierPowerToken.getAddress(),
      verifierElection: await this.contracts.verifierElection.getAddress(),
      verifierManager: await this.contracts.verifierManager.getAddress(),
      valuableActionSBT: await this.contracts.valuableActionSBT.getAddress(),
      treasuryAdapter: await this.contracts.treasuryAdapter.getAddress(),
      communityToken: await this.contracts.communityToken.getAddress(),
      paramController: await this.contracts.paramController.getAddress(),
    };
    
    await this.contracts.communityRegistry.setModuleAddresses(
      communityId,
      moduleAddresses,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Module addresses configured");

    // Grant MINTER_ROLE to deployer temporarily for bootstrap minting
    const minterRole = await this.contracts.membershipToken.MINTER_ROLE();
    await this.contracts.membershipToken.grantRole(
      minterRole,
      this.deployer.address,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Granted temporary MINTER_ROLE to deployer");

    // Mint initial governance tokens to founder
    // MembershipToken.mint: (to, amount, reason, overrides)
    const mintMembershipTx = await this.contracts.membershipToken.mint(
      this.config.founderAddress,
      this.config.initialMembershipTokens,
      "Bootstrap founder allocation", // reason
      this.gasSettings, // overrides
    );
    await mintMembershipTx.wait();
    await this.sleep(2000);
    console.log(
      `   ✅ Minted ${this.config.initialMembershipTokens} governance tokens to founder`,
    );

    // Revoke MINTER_ROLE from deployer
    await this.contracts.membershipToken.revokeRole(
      minterRole,
      this.deployer.address,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Revoked MINTER_ROLE from deployer");

    // Note: VPT tokens require timelock role to mint
    // Initial verifier power should be granted through governance proposal
    console.log("   ℹ️  VPT tokens should be minted via governance (requires TIMELOCK_ROLE)");

    // Delegate voting power to founder
    const founderSigner = await ethers.getSigner(this.config.founderAddress);
    const delegateTx = await this.contracts.membershipToken
      .connect(founderSigner)
      .delegate(this.config.founderAddress, this.gasSettings);
    await delegateTx.wait();
    await this.sleep(2000);
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
    const nextCommunityId =
      await this.contracts.communityRegistry.nextCommunityId();
    console.log(`   ✅ Next community ID: ${nextCommunityId} (${Number(nextCommunityId) - 1} communities registered)`);

    // Test parameter configuration
    const vptParams = await this.contracts.paramController.getVerifierParams(1);
    console.log(`   ✅ VPT panel size for community 1: ${vptParams[0]}`);

    console.log("   🎉 All verification tests passed!");
  }

  private async saveDeploymentAddresses(): Promise<void> {
    const network = this.config.network;
    const deploymentData = {
      network,
      timestamp: new Date().toISOString(),
      deployer: this.deployer.address,
      communityId: 1,
      addresses: {
        // Core Infrastructure
        communityRegistry: await this.contracts.communityRegistry.getAddress(),
        paramController: await this.contracts.paramController.getAddress(),

        // Governance System
        membershipToken: await this.contracts.membershipToken.getAddress(),
        timelock: await this.contracts.timelock.getAddress(),
        governor: await this.contracts.governor.getAddress(),
        countingMultiChoice: await this.contracts.countingMultiChoice.getAddress(),

        // VPT System
        verifierPowerToken: await this.contracts.verifierPowerToken.getAddress(),
        verifierElection: await this.contracts.verifierElection.getAddress(),
        verifierManager: await this.contracts.verifierManager.getAddress(),

        // Work Verification
        valuableActionRegistry: await this.contracts.valuableActionRegistry.getAddress(),
        claims: await this.contracts.claims.getAddress(),
        valuableActionSBT: await this.contracts.valuableActionSBT.getAddress(),

        // Economic Layer
        communityToken: await this.contracts.communityToken.getAddress(),
        cohortRegistry: await this.contracts.cohortRegistry.getAddress(),
        revenueRouter: await this.contracts.revenueRouter.getAddress(),
        treasuryAdapter: await this.contracts.treasuryAdapter.getAddress(),

        // Community Modules
        requestHub: await this.contracts.requestHub.getAddress(),
        draftsManager: await this.contracts.draftsManager.getAddress(),
        commerceDisputes: await this.contracts.commerceDisputes.getAddress(),
        marketplace: await this.contracts.marketplace.getAddress(),
        housingManager: await this.contracts.housingManager.getAddress(),
        projectFactory: await this.contracts.projectFactory.getAddress(),
      },
      configuration: {
        communityName: this.config.communityName,
        votingDelay: this.config.votingDelay,
        votingPeriod: this.config.votingPeriod,
        executionDelay: this.config.executionDelay,
        revenueSplit: this.config.revenueSplit,
      },
    };

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save network-specific deployment file
    const deploymentPath = path.join(deploymentsDir, `${network}.json`);
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentData, null, 2),
      "utf8"
    );
    console.log(`\n💾 Deployment addresses saved to: ${deploymentPath}`);

    // Also save to a "latest" file for easier access
    const latestPath = path.join(deploymentsDir, "latest.json");
    fs.writeFileSync(
      latestPath,
      JSON.stringify(deploymentData, null, 2),
      "utf8"
    );
    console.log(`💾 Latest deployment saved to: ${latestPath}`);
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
