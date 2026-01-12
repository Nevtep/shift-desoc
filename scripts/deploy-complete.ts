/**
 * Shift DeSoc Complete System Deployment Script (env-driven)
 *
 * Deploys and wires the full stack with Timelock-owned defaults unless DEV_MODE=true.
 */

require("dotenv/config");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

type DeploymentConfig = {
  network: string;
  communityId: number;
  communityName: string;
  communityDescription: string;
  founderAddress: string;
  devMode: boolean;
  treasuryVault: string;
  treasuryStableToken: string;
  supportedTokens: string[];
  minTreasuryBps: number;
  minPositionsBps: number;
  spilloverTarget: number;
  spilloverSplitBpsTreasury: number;
  initialMembershipTokens: number;
  initialVPTTokens: number;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: number;
  executionDelay: number;
  verifierPanelSize: number;
  verifierMin: number;
  maxPanelsPerEpoch: number;
  useVPTWeighting: boolean;
  maxWeightPerVerifier: number;
  cooldownAfterFraud: number;
  electionDuration: number;
  minVotingPower: number;
};

type PostDeployChecks = {
  founderBalance: string;
  founderVPTBalance: string;
  nextCommunityId: number;
  vptPanelSize: string;
};

type DeploymentReport = {
  network: string;
  timestamp: string;
  deployer: string;
  devMode: boolean;
  communityId: number;
  communityName: string;
  addresses: { [key: string]: string };
  configuration: {
    treasuryVault: string;
    treasuryStableToken: string;
    supportedTokens: string[];
    initialMembershipTokens: number;
    initialVPTTokens: number;
    minTreasuryBps: number;
    minPositionsBps: number;
    spilloverTarget: number;
    spilloverSplitBpsTreasury: number;
    proposalThreshold: number;
    votingDelay: number;
    votingPeriod: number;
    executionDelay: number;
    verifierPanelSize: number;
    verifierMin: number;
    maxPanelsPerEpoch: number;
    useVPTWeighting: boolean;
    maxWeightPerVerifier: number;
    cooldownAfterFraud: number;
  };
  postDeployChecks: PostDeployChecks;
};

const REQUIRED_ENVS = [
  "PRIVATE_KEY",
  "TREASURY_VAULT",
  "TREASURY_STABLE_TOKEN",
  "COMMUNITY_ID_DEFAULT",
  "MIN_TREASURY_BPS",
  "MIN_POSITIONS_BPS",
  "SPILLOVER_TARGET",
  "SPILLOVER_SPLIT_BPS_TREASURY",
  "SUPPORTED_TOKENS",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function parseBool(input: string | undefined, fallback: boolean) {
  if (input === undefined) return fallback;
  return input.toLowerCase() === "true";
}

function parseAddresses(csv: string): string[] {
  return csv
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

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
    const checks = await this.verifyDeployment();

    const report = await this.buildDeploymentReport(checks);

    console.log("\n✅ Shift DeSoc deployment completed successfully!");
    this.printDeploymentSummary(report);
    await this.saveDeploymentAddresses(report);
    this.printJsonReport(report);
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

    // Wire ParamController to CommunityRegistry (one-time)
    await (
      await this.contracts.paramController.setCommunityRegistry(
        await this.contracts.communityRegistry.getAddress(),
      )
    ).wait();
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
      this.config.communityId,
      this.deployer.address,
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
      [],
      [],
      this.deployer.address,
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

    const governanceAddr = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();

    // Deploy ValuableActionRegistry
    console.log("   📋 Deploying ValuableActionRegistry...");
    const ValuableActionRegistry = await ethers.getContractFactory(
      "ValuableActionRegistry",
    );
    this.contracts.valuableActionRegistry = await this.deployContract(
      ValuableActionRegistry,
      governanceAddr,
      await this.contracts.communityRegistry.getAddress(), // community registry for module validation
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
      this.deployer.address, // manager (will be reassigned to modules)
      governanceAddr,
    );
    console.log(
      `   ✅ ValuableActionSBT: ${await this.contracts.valuableActionSBT.getAddress()}`,
    );

    // Deploy Engagements
    console.log("   📝 Deploying Engagements...");
    const Engagements = await ethers.getContractFactory("Engagements");
    this.contracts.engagements = await this.deployContract(
      Engagements,
      governanceAddr,
      await this.contracts.valuableActionRegistry.getAddress(),
      await this.contracts.verifierManager.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
      await this.contracts.membershipToken.getAddress(),
      this.config.communityId,
    );
    console.log(`   ✅ Engagements: ${await this.contracts.engagements.getAddress()}`);

    // Deploy PositionManager
    console.log("   🧭 Deploying PositionManager...");
    const PositionManager = await ethers.getContractFactory("PositionManager");
    this.contracts.positionManager = await this.deployContract(
      PositionManager,
      governanceAddr,
      await this.contracts.valuableActionRegistry.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
    );
    console.log(
      `   ✅ PositionManager: ${await this.contracts.positionManager.getAddress()}`,
    );

    // Deploy CredentialManager
    console.log("   🎓 Deploying CredentialManager...");
    const CredentialManager = await ethers.getContractFactory(
      "CredentialManager",
    );
    this.contracts.credentialManager = await this.deployContract(
      CredentialManager,
      governanceAddr,
      await this.contracts.valuableActionRegistry.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
    );
    console.log(
      `   ✅ CredentialManager: ${await this.contracts.credentialManager.getAddress()}`,
    );
  }

  private async deployEconomicLayer(): Promise<void> {
    console.log("\n💰 5. Deploying Economic Layer...");

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

    // Deploy RevenueRouter with pull-based indices
    console.log("   📊 Deploying RevenueRouter...");
    const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
    const revenueAdmin = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.revenueRouter = await this.deployContract(
      RevenueRouter,
      await this.contracts.paramController.getAddress(),
      await this.contracts.cohortRegistry.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
      revenueAdmin,
    );
    console.log(
      `   ✅ RevenueRouter: ${await this.contracts.revenueRouter.getAddress()}`,
    );

    // Deploy InvestmentCohortManager (needs CohortRegistry)
    console.log("   💹 Deploying InvestmentCohortManager...");
    const InvestmentCohortManager = await ethers.getContractFactory(
      "InvestmentCohortManager",
    );
    const invGovernance = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.investmentCohortManager = await this.deployContract(
      InvestmentCohortManager,
      invGovernance,
      await this.contracts.cohortRegistry.getAddress(),
      await this.contracts.valuableActionRegistry.getAddress(),
      await this.contracts.valuableActionSBT.getAddress(),
    );
    console.log(
      `   ✅ InvestmentCohortManager: ${await this.contracts.investmentCohortManager.getAddress()}`,
    );

    // Deploy CommunityToken
    console.log("   🪙 Deploying CommunityToken...");
    const CommunityToken = await ethers.getContractFactory("CommunityToken");
    this.contracts.communityToken = await this.deployContract(
      CommunityToken,
      this.config.treasuryStableToken,
      this.config.communityId,
      "Shift Community Token",
      "SCT",
      this.config.treasuryVault,
      ethers.parseEther("1000000"),
      await this.contracts.paramController.getAddress(),
    );
    console.log(
      `   ✅ CommunityToken: ${await this.contracts.communityToken.getAddress()}`,
    );

    // Deploy TreasuryAdapter
    console.log("   🏦 Deploying TreasuryAdapter...");
    const TreasuryAdapter = await ethers.getContractFactory("TreasuryAdapter");
    const treasuryGov = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.treasuryAdapter = await this.deployContract(
      TreasuryAdapter,
      treasuryGov,
      await this.contracts.communityRegistry.getAddress(),
    );
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
      await this.contracts.valuableActionRegistry.getAddress(),
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
      await this.contracts.timelock.getAddress(),
    );
    console.log(
      `   ✅ DraftsManager: ${await this.contracts.draftsManager.getAddress()}`,
    );

    // Deploy CommerceDisputes (needed by Marketplace)
    console.log("   ⚖️  Deploying CommerceDisputes...");
    const CommerceDisputes = await ethers.getContractFactory("CommerceDisputes");
    const commerceOwner = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.commerceDisputes = await this.deployContract(
      CommerceDisputes,
      commerceOwner,
    );
    console.log(
      `   ✅ CommerceDisputes: ${await this.contracts.commerceDisputes.getAddress()}`,
    );

    // Deploy Marketplace (depends on CommerceDisputes and RevenueRouter)
    console.log("   🛍️  Deploying Marketplace...");
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplaceOwner = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.marketplace = await this.deployContract(
      Marketplace,
      marketplaceOwner,
      await this.contracts.commerceDisputes.getAddress(),
      await this.contracts.revenueRouter.getAddress(),
    );
    console.log(
      `   ✅ Marketplace: ${await this.contracts.marketplace.getAddress()}`,
    );

    // Deploy HousingManager (depends on Marketplace)
    console.log("   🏠 Deploying HousingManager...");
    const HousingManager = await ethers.getContractFactory("HousingManager");
    const housingOwner = this.config.devMode
      ? this.deployer.address
      : await this.contracts.timelock.getAddress();
    this.contracts.housingManager = await this.deployContract(
      HousingManager,
      housingOwner,
      await this.contracts.marketplace.getAddress(),
      this.config.treasuryStableToken,
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

    // Wire counting module (multi-choice)
    const multiCounter = await this.contracts.countingMultiChoice.getAddress();
    const currentCounter = await this.contracts.governor.multiCounter();
    if (currentCounter === ethers.ZeroAddress) {
      await this.contracts.governor.initCountingMulti(multiCounter, this.gasSettings);
      console.log("   ✅ CountingMultiChoice initialized on Governor");
    }

    // Renounce admin role - timelock is now fully controlled by governance
    await this.contracts.timelock.renounceRole(adminRole, this.deployer.address, this.gasSettings);
    console.log("   ✅ Deployer renounced timelock admin role");
  }

  private async configureSystemIntegration(): Promise<void> {
    console.log("\n🔗 7. Configuring System Integration...");

    // This is where we would register all module addresses in the CommunityRegistry
    // and set up cross-contract permissions and integrations

    console.log("   🔧 Setting up cross-contract integrations...");

    // Configure VPT parameters for initial community
    await this.contracts.paramController.setVerifierParams(
      this.config.communityId,
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
    await this.contracts.paramController.setRevenuePolicy(
      this.config.communityId,
      this.config.minTreasuryBps,
      this.config.minPositionsBps,
      this.config.spilloverTarget,
      this.config.spilloverSplitBpsTreasury,
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log(`   ✅ Revenue policy configured for community ${this.config.communityId}`);

    // Governance + eligibility defaults
    await this.contracts.paramController.setGovernanceParams(
      this.config.communityId,
      this.config.votingDelay,
      this.config.votingPeriod,
      this.config.executionDelay,
      this.gasSettings,
    );
    await this.contracts.paramController.setEligibilityParams(
      this.config.communityId,
      0,
      0,
      this.config.proposalThreshold,
      this.gasSettings,
    );

    // RevenueRouter wiring (admin-only)
    if (this.config.devMode) {
      await this.contracts.revenueRouter.setCommunityTreasury(
        this.config.communityId,
        this.config.treasuryVault,
        this.gasSettings,
      );
      for (const token of this.config.supportedTokens) {
        await this.contracts.revenueRouter.setSupportedToken(
          this.config.communityId,
          token,
          true,
          this.gasSettings,
        );
      }
      const positionRole = await this.contracts.revenueRouter.POSITION_MANAGER_ROLE();
      await this.contracts.revenueRouter.grantRole(
        positionRole,
        await this.contracts.positionManager.getAddress(),
        this.gasSettings,
      );
      await this.contracts.positionManager.setRevenueRouter(
        await this.contracts.revenueRouter.getAddress(),
        this.gasSettings,
      );
      console.log("   ✅ RevenueRouter treasury, tokens, position role configured (dev mode)");
    } else {
      console.log("   ℹ️ RevenueRouter treasury/tokens/roles must be configured via governance");
    }

    // Wire ValuableActionRegistry -> ValuableActionSBT (governance-gated)
    try {
      await this.contracts.valuableActionRegistry.setValuableActionSBT(
        await this.contracts.valuableActionSBT.getAddress(),
        this.gasSettings,
      );
      console.log("   ✅ ValuableActionSBT set on ValuableActionRegistry");
    } catch (error) {
      console.warn("   ⚠️ setValuableActionSBT requires governance (timelock)");
    }

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
      await this.contracts.engagements.getAddress(),
      this.gasSettings,
    );
    await this.sleep(2000);
    console.log("   ✅ Granted MINTER_ROLE to Engagements contract");

    // Wire VerifierManager
    try {
      await this.contracts.verifierManager.setEngagementsContract(
        await this.contracts.engagements.getAddress(),
        this.gasSettings,
      );
      console.log("   ✅ VerifierManager engagements contract set");
    } catch (error) {
      console.warn("   ⚠️ VerifierManager.setEngagementsContract requires governance");
    }

    // ValuableActionSBT manager roles
    const managerRole = await this.contracts.valuableActionSBT.MANAGER_ROLE();
    const sbtManagers = [
      this.contracts.engagements,
      this.contracts.positionManager,
      this.contracts.investmentCohortManager,
      this.contracts.credentialManager,
    ];
    for (const mgr of sbtManagers) {
      await this.contracts.valuableActionSBT.grantRole(
        managerRole,
        await mgr.getAddress(),
        this.gasSettings,
      );
    }
    if (!this.config.devMode) {
      await this.contracts.valuableActionSBT.grantRole(
        await this.contracts.valuableActionSBT.DEFAULT_ADMIN_ROLE(),
        await this.contracts.timelock.getAddress(),
        this.gasSettings,
      );
      await this.contracts.valuableActionSBT.revokeRole(
        await this.contracts.valuableActionSBT.DEFAULT_ADMIN_ROLE(),
        this.deployer.address,
        this.gasSettings,
      );
    }

    // Configure commerce module integrations
    console.log("   🛍️  Configuring commerce module integrations...");

    if (this.config.devMode) {
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
    } else {
      console.log("   ℹ️ CommerceDisputes/RevenueRouter roles must be granted via governance (timelock)");
    }

    // Allow RequestHub and managers to issue SBTs (devMode direct, otherwise governance)
    const issuanceTargets = [
      this.contracts.requestHub,
      this.contracts.engagements,
      this.contracts.positionManager,
      this.contracts.investmentCohortManager,
      this.contracts.credentialManager,
    ];
    for (const target of issuanceTargets) {
      try {
        await this.contracts.valuableActionRegistry.setIssuanceModule(
          await target.getAddress(),
          true,
          this.gasSettings,
        );
        await this.sleep(500);
        console.log(`   ✅ Issuance module enabled: ${target.target}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(
          `   ⚠️ Issuance module requires governance for ${target?.target ?? "unknown"}:`,
          message,
        );
      }
    }

    // TreasuryAdapter allowlists (dev mode direct; otherwise governance proposal required)
    if (this.config.devMode) {
      for (const token of this.config.supportedTokens) {
        await this.contracts.treasuryAdapter.setTokenAllowed(
          this.config.communityId,
          token,
          true,
          this.gasSettings,
        );
        await this.contracts.treasuryAdapter.setCapBps(
          this.config.communityId,
          token,
          1000,
          this.gasSettings,
        );
      }
      await this.contracts.treasuryAdapter.setDestinationAllowed(
        this.config.communityId,
        await this.contracts.requestHub.getAddress(),
        true,
        this.gasSettings,
      );
      console.log("   ✅ TreasuryAdapter dev allowlists applied");
    } else {
      console.log("   ℹ️ TreasuryAdapter allowlists must be set via governance (timelock)");
    }
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
    const nextId = await this.contracts.communityRegistry.nextCommunityId();
    const communityId = Number(nextId) - 1;
    this.config.communityId = communityId;
    console.log(`   ✅ Initial community registered as ID ${communityId}`);

    // Step 2: Set module addresses for the community
    console.log("   🔧 Configuring community modules...");
    const moduleAddresses = {
      governor: await this.contracts.governor.getAddress(),
      timelock: await this.contracts.timelock.getAddress(),
      requestHub: await this.contracts.requestHub.getAddress(),
      draftsManager: await this.contracts.draftsManager.getAddress(),
      engagementsManager: await this.contracts.engagements.getAddress(),
      valuableActionRegistry: await this.contracts.valuableActionRegistry.getAddress(),
      verifierPowerToken: await this.contracts.verifierPowerToken.getAddress(),
      verifierElection: await this.contracts.verifierElection.getAddress(),
      verifierManager: await this.contracts.verifierManager.getAddress(),
      valuableActionSBT: await this.contracts.valuableActionSBT.getAddress(),
      treasuryVault: this.config.treasuryVault,
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

    if (this.config.initialMembershipTokens > 0) {
      const minterRole = await this.contracts.membershipToken.MINTER_ROLE();
      await this.contracts.membershipToken.grantRole(
        minterRole,
        this.deployer.address,
        this.gasSettings,
      );
      await this.sleep(1000);

      const mintMembershipTx = await this.contracts.membershipToken.mint(
        this.config.founderAddress,
        this.config.initialMembershipTokens,
        "Bootstrap founder allocation",
        this.gasSettings,
      );
      await mintMembershipTx.wait();
      await this.sleep(1000);
      console.log(
        `   ✅ Minted ${this.config.initialMembershipTokens} governance tokens to founder`,
      );

      await this.contracts.membershipToken.revokeRole(
        minterRole,
        this.deployer.address,
        this.gasSettings,
      );
      await this.sleep(1000);
      console.log("   ✅ Revoked MINTER_ROLE from deployer");
    }

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

  private async verifyDeployment(): Promise<PostDeployChecks> {
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
    const vptParams = await this.contracts.paramController.getVerifierParams(this.config.communityId);
    console.log(`   ✅ VPT panel size for community ${this.config.communityId}: ${vptParams[0]}`);

    console.log("   🎉 All verification tests passed!");

    return {
      founderBalance: founderBalance.toString(),
      founderVPTBalance: founderVPTBalance.toString(),
      nextCommunityId: Number(nextCommunityId),
      vptPanelSize: vptParams[0].toString(),
    };
  }

  private async buildDeploymentReport(
    checks: PostDeployChecks,
  ): Promise<DeploymentReport> {
    const addresses = {
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
      engagements: await this.contracts.engagements.getAddress(),
      valuableActionSBT: await this.contracts.valuableActionSBT.getAddress(),
      positionManager: await this.contracts.positionManager.getAddress(),
      investmentCohortManager: await this.contracts.investmentCohortManager.getAddress(),
      credentialManager: await this.contracts.credentialManager.getAddress(),

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
    };

    return {
      network: this.config.network,
      timestamp: new Date().toISOString(),
      deployer: this.deployer.address,
      devMode: this.config.devMode,
      communityId: this.config.communityId,
      communityName: this.config.communityName,
      addresses,
      configuration: {
        treasuryVault: this.config.treasuryVault,
        treasuryStableToken: this.config.treasuryStableToken,
        supportedTokens: this.config.supportedTokens,
        initialMembershipTokens: this.config.initialMembershipTokens,
        initialVPTTokens: this.config.initialVPTTokens,
        minTreasuryBps: this.config.minTreasuryBps,
        minPositionsBps: this.config.minPositionsBps,
        spilloverTarget: this.config.spilloverTarget,
        spilloverSplitBpsTreasury: this.config.spilloverSplitBpsTreasury,
        proposalThreshold: this.config.proposalThreshold,
        votingDelay: this.config.votingDelay,
        votingPeriod: this.config.votingPeriod,
        executionDelay: this.config.executionDelay,
        verifierPanelSize: this.config.verifierPanelSize,
        verifierMin: this.config.verifierMin,
        maxPanelsPerEpoch: this.config.maxPanelsPerEpoch,
        useVPTWeighting: this.config.useVPTWeighting,
        maxWeightPerVerifier: this.config.maxWeightPerVerifier,
        cooldownAfterFraud: this.config.cooldownAfterFraud,
      },
      postDeployChecks: checks,
    };
  }

  private async saveDeploymentAddresses(report: DeploymentReport): Promise<void> {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentPath = path.join(deploymentsDir, `${report.network}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\n💾 Deployment addresses saved to: ${deploymentPath}`);

    const latestPath = path.join(deploymentsDir, "latest.json");
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`💾 Latest deployment saved to: ${latestPath}`);
  }

  private printDeploymentSummary(report: DeploymentReport): void {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 SHIFT DESOC DEPLOYMENT SUMMARY");
    console.log("=".repeat(70));
    console.log(`Network: ${report.network}`);
    console.log(`Deployer: ${report.deployer}`);
    console.log(`Community: ${report.communityName}`);

    console.log("\n📍 CORE INFRASTRUCTURE:");
    console.log(`   CommunityRegistry: ${report.addresses.communityRegistry}`);
    console.log(`   ParamController: ${report.addresses.paramController}`);

    console.log("\n🏛️  GOVERNANCE SYSTEM:");
    console.log(`   MembershipToken: ${report.addresses.membershipToken}`);
    console.log(`   TimelockController: ${report.addresses.timelock}`);
    console.log(`   ShiftGovernor: ${report.addresses.governor}`);
    console.log(`   CountingMultiChoice: ${report.addresses.countingMultiChoice}`);

    console.log("\n👥 VPT SYSTEM:");
    console.log(`   VerifierPowerToken1155: ${report.addresses.verifierPowerToken}`);
    console.log(`   VerifierElection: ${report.addresses.verifierElection}`);
    console.log(`   VerifierManager: ${report.addresses.verifierManager}`);

    console.log("\n🔍 WORK VERIFICATION:");
    console.log(`   ValuableActionRegistry: ${report.addresses.valuableActionRegistry}`);
    console.log(`   Engagements: ${report.addresses.engagements}`);
    console.log(`   ValuableActionSBT: ${report.addresses.valuableActionSBT}`);
    console.log(`   PositionManager: ${report.addresses.positionManager}`);
    console.log(`   InvestmentCohortManager: ${report.addresses.investmentCohortManager}`);
    console.log(`   CredentialManager: ${report.addresses.credentialManager}`);

    console.log("\n💰 ECONOMIC LAYER:");
    console.log(`   CommunityToken: ${report.addresses.communityToken}`);
    console.log(`   CohortRegistry: ${report.addresses.cohortRegistry}`);
    console.log(`   RevenueRouter: ${report.addresses.revenueRouter}`);
    console.log(`   TreasuryAdapter: ${report.addresses.treasuryAdapter}`);

    console.log("\n🏘️  COMMUNITY MODULES:");
    console.log(`   RequestHub: ${report.addresses.requestHub}`);
    console.log(`   DraftsManager: ${report.addresses.draftsManager}`);
    console.log(`   HousingManager: ${report.addresses.housingManager}`);
    console.log(`   Marketplace: ${report.addresses.marketplace}`);
    console.log(`   ProjectFactory: ${report.addresses.projectFactory}`);

    console.log("\n⚙️  SYSTEM CONFIGURATION:");
    console.log(
      `   Governance tokens: ${report.configuration.initialMembershipTokens} (to founder)`,
    );
    console.log(`   VPT tokens: ${report.configuration.initialVPTTokens} (to founder)`);
    console.log(
      `   Revenue policy: treasury ${report.configuration.minTreasuryBps} bps, positions ${report.configuration.minPositionsBps} bps, spilloverTarget ${report.configuration.spilloverTarget}, splitToTreasury ${report.configuration.spilloverSplitBpsTreasury} bps`,
    );
    console.log(
      `   Verifier panel: ${report.configuration.verifierPanelSize} members, ${report.configuration.verifierMin} minimum approvals`,
    );
    console.log(
      `   Post-deploy: founder gov balance ${report.postDeployChecks.founderBalance}, VPT ${report.postDeployChecks.founderVPTBalance}, nextCommunityId ${report.postDeployChecks.nextCommunityId}`,
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
    console.log("   npm run manage engagements  # Engagements and verification");
  }

  private printJsonReport(report: DeploymentReport): void {
    console.log("\n🧾 Deployment JSON report:");
    console.log(JSON.stringify(report, null, 2));
  }
}

// Main deployment function
async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "hardhat";
  console.log(`\n🌐 Deploying to network: ${networkName}`);

  // Hard-require critical env vars
  REQUIRED_ENVS.forEach(requireEnv);

  const config: DeploymentConfig = {
    network: networkName,
    communityId: Number(requireEnv("COMMUNITY_ID_DEFAULT")),
    communityName: process.env.COMMUNITY_NAME || "Shift DeSoc Community",
    communityDescription:
      "A decentralized cooperative community powered by Shift DeSoc technology",
    founderAddress: process.env.FOUNDER_ADDRESS || "",
    devMode: parseBool(process.env.DEV_MODE, false),
    treasuryVault: requireEnv("TREASURY_VAULT"),
    treasuryStableToken: requireEnv("TREASURY_STABLE_TOKEN"),
    supportedTokens: parseAddresses(requireEnv("SUPPORTED_TOKENS")),
    minTreasuryBps: Number(requireEnv("MIN_TREASURY_BPS")),
    minPositionsBps: Number(requireEnv("MIN_POSITIONS_BPS")),
    spilloverTarget: Number(requireEnv("SPILLOVER_TARGET")),
    spilloverSplitBpsTreasury: Number(requireEnv("SPILLOVER_SPLIT_BPS_TREASURY")),
    initialMembershipTokens: Number(process.env.INITIAL_MEMBERSHIP_TOKENS || 0),
    initialVPTTokens: Number(process.env.INITIAL_VPT_TOKENS || 0),
    votingDelay: Number(process.env.VOTING_DELAY || 7200),
    votingPeriod: Number(process.env.VOTING_PERIOD || 86400),
    proposalThreshold: Number(process.env.PROPOSAL_THRESHOLD || 0),
    executionDelay: Number(process.env.EXECUTION_DELAY || 21600),
    verifierPanelSize: Number(process.env.VERIFIER_PANEL_SIZE || 5),
    verifierMin: Number(process.env.VERIFIER_MIN || 3),
    maxPanelsPerEpoch: Number(process.env.MAX_PANELS_PER_EPOCH || 20),
    useVPTWeighting: parseBool(process.env.USE_VPT_WEIGHTING, true),
    maxWeightPerVerifier: Number(process.env.MAX_WEIGHT_PER_VERIFIER || 1000),
    cooldownAfterFraud: Number(process.env.COOLDOWN_AFTER_FRAUD || 86400),
    electionDuration: Number(process.env.ELECTION_DURATION || 259200),
    minVotingPower: Number(process.env.MIN_VOTING_POWER || 100),
  };

  console.log(
    `Using configuration: ${config.communityName} on ${config.network} (communityId=${config.communityId})`,
  );

  // Deploy the complete system
  const deployer = new ShiftDeSocDeployer(config);
  await deployer.deploy();

  console.log(`\n🎉 Shift DeSoc successfully deployed to ${networkName}!`);
}

// Export for programmatic use
export { ShiftDeSocDeployer, type DeploymentConfig };

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}
