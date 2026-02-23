import fs from "fs";
import path from "path";
import hre from "hardhat";
import { Roles } from "../roles";

const { ethers, network } = hre;

export type SharedInfra = {
  accessManager: string;
  paramController: string;
  communityRegistry: string;
};

export type CommunityStackAddresses = SharedInfra & {
  membershipToken: string;
  timelock: string;
  governor: string;
  countingMultiChoice: string;
  verifierPowerToken: string;
  verifierElection: string;
  verifierManager: string;
  valuableActionRegistry: string;
  valuableActionSBT: string;
  engagements: string;
  positionManager: string;
  credentialManager: string;
  cohortRegistry: string;
  investmentCohortManager: string;
  revenueRouter: string;
  communityToken: string;
  treasuryAdapter: string;
  requestHub: string;
  draftsManager: string;
  commerceDisputes: string;
  marketplace: string;
  housingManager: string;
  projectFactory: string;
};

export type DeploymentJson = {
  network: string;
  timestamp: string;
  deployer: string;
  communityId?: number;
  addresses: Record<string, string>;
  configuration?: Record<string, any>;
  startBlock?: number;
};

export type CommunityDeployConfig = {
  communityName: string;
  communityDescription: string;
  communityMetadataURI: string;
  founderAddress: string;
  treasuryVault: string;
  treasuryStableToken: string;
  supportedTokens: string[];
  initialMembershipTokens: bigint;
  proposalThreshold: bigint;
  votingDelay: number;
  votingPeriod: number;
  executionDelay: number;
  verifierPanelSize: number;
  verifierMin: number;
  maxPanelsPerEpoch: number;
  useVPTWeighting: boolean;
  maxWeightPerVerifier: number;
  cooldownAfterFraud: number;
  minTreasuryBps: number;
  minPositionsBps: number;
  spilloverTarget: number;
  spilloverSplitBpsTreasury: number;
  vptMetadataURI: string;
};

const DEPLOYMENTS_DIR = path.join(process.cwd(), "deployments");
const VPT_ELECTION_POWER_ROLE = 1001n;

export function defaultCommunityDeployConfig(founderAddress: string): CommunityDeployConfig {
  return {
    communityName: "Shift DeSoc Community",
    communityDescription: "A decentralized cooperative community powered by Shift DeSoc technology",
    communityMetadataURI: "",
    founderAddress,
    treasuryVault: founderAddress,
    treasuryStableToken: founderAddress,
    supportedTokens: [founderAddress],
    initialMembershipTokens: 0n,
    proposalThreshold: 0n,
    votingDelay: 7200,
    votingPeriod: 86400,
    executionDelay: 21600,
    verifierPanelSize: 5,
    verifierMin: 3,
    maxPanelsPerEpoch: 20,
    useVPTWeighting: true,
    maxWeightPerVerifier: 1000,
    cooldownAfterFraud: 86400,
    minTreasuryBps: 1000,
    minPositionsBps: 2000,
    spilloverTarget: 1,
    spilloverSplitBpsTreasury: 5000,
    vptMetadataURI: "ipfs://shift/vpt",
  };
}

function networkName(): string {
  if (network?.name && network.name.length > 0) {
    return network.name;
  }
  return process.env.HARDHAT_NETWORK || "hardhat";
}

function deploymentsPathFor(net: string): string {
  return path.join(DEPLOYMENTS_DIR, `${net}.json`);
}

function latestDeploymentsPath(): string {
  return path.join(DEPLOYMENTS_DIR, "latest.json");
}

export function loadDeploymentFile(net = networkName()): DeploymentJson | null {
  const netPath = deploymentsPathFor(net);
  if (fs.existsSync(netPath)) {
    return JSON.parse(fs.readFileSync(netPath, "utf8")) as DeploymentJson;
  }

  const latestPath = latestDeploymentsPath();
  if (fs.existsSync(latestPath)) {
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf8")) as DeploymentJson;
    if (latest.network === net) return latest;
  }

  return null;
}

export function saveDeploymentFile(payload: DeploymentJson, net = networkName()): void {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }

  const normalized: DeploymentJson = {
    network: net,
    timestamp: payload.timestamp,
    deployer: payload.deployer,
    communityId: payload.communityId,
    addresses: payload.addresses,
    configuration: payload.configuration,
    startBlock: payload.startBlock,
  };

  fs.writeFileSync(deploymentsPathFor(net), JSON.stringify(normalized, null, 2));
  fs.writeFileSync(latestDeploymentsPath(), JSON.stringify(normalized, null, 2));
}

function requireAddress(value: string | undefined, name: string): string {
  if (!value || value === ethers.ZeroAddress) {
    throw new Error(`Missing required address: ${name}`);
  }
  return value;
}

async function deploy<T>(factoryName: string, ...args: any[]): Promise<T & { getAddress(): Promise<string> }> {
  const factory = await ethers.getContractFactory(factoryName);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract as any;
}

async function deployTimelockController(...args: any[]): Promise<any> {
  const factory = await ethers.getContractFactory("ShiftTimelockController");
  const timelock = await factory.deploy(...args);
  await timelock.waitForDeployment();
  return timelock;
}

async function deployAccessManager(admin: string): Promise<any> {
  const factory = await ethers.getContractFactory("ShiftAccessManager");
  const accessManager = await factory.deploy(admin);
  await accessManager.waitForDeployment();
  return accessManager;
}

export async function deploySharedInfraIfMissing(): Promise<SharedInfra> {
  const net = networkName();
  const existing = net === "hardhat" ? null : loadDeploymentFile(net);
  if (
    existing?.addresses?.accessManager &&
    existing?.addresses?.paramController &&
    existing?.addresses?.communityRegistry
  ) {
    return {
      accessManager: existing.addresses.accessManager,
      paramController: existing.addresses.paramController,
      communityRegistry: existing.addresses.communityRegistry,
    };
  }

  const [deployer] = await ethers.getSigners();

  const accessManager = await deployAccessManager(deployer.address);
  const paramController = await deploy<any>("ParamController", deployer.address);
  const communityRegistry = await deploy<any>(
    "CommunityRegistry",
    await accessManager.getAddress(),
    await paramController.getAddress(),
  );
  await (await paramController.setCommunityRegistry(await communityRegistry.getAddress())).wait();

  const currentBlock = await ethers.provider.getBlockNumber();
  const merged = {
    ...(existing ?? {
      network: networkName(),
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      addresses: {},
    }),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    addresses: {
      ...(existing?.addresses ?? {}),
      accessManager: await accessManager.getAddress(),
      paramController: await paramController.getAddress(),
      communityRegistry: await communityRegistry.getAddress(),
    },
    startBlock: existing?.startBlock ?? currentBlock,
  } as DeploymentJson;

  saveDeploymentFile(merged, net);

  return {
    accessManager: await accessManager.getAddress(),
    paramController: await paramController.getAddress(),
    communityRegistry: await communityRegistry.getAddress(),
  };
}

export async function deployCommunityStack(config: CommunityDeployConfig): Promise<{ communityId: number; addresses: CommunityStackAddresses }> {
  const [deployer] = await ethers.getSigners();
  const shared = await deploySharedInfraIfMissing();

  const communityRegistry = await ethers.getContractAt("CommunityRegistry", shared.communityRegistry);
  const paramController = await ethers.getContractAt("ParamController", shared.paramController);

  const nextCommunityId = Number(await communityRegistry.nextCommunityId());

  const membershipToken = await deploy<any>(
    "MembershipTokenERC20Votes",
    `${config.communityName} Membership`,
    `sMEM-${nextCommunityId}`,
    nextCommunityId,
    shared.accessManager,
  );

  const timelock = await deployTimelockController(
    config.executionDelay,
    [],
    [],
    deployer.address,
  );

  const governor = await deploy<any>(
    "ShiftGovernor",
    await membershipToken.getAddress(),
    shared.accessManager,
    config.executionDelay,
  );

  const countingMultiChoice = await deploy<any>("CountingMultiChoice", await governor.getAddress());

  const verifierPowerToken = await deploy<any>("VerifierPowerToken1155", shared.accessManager, "");
  const verifierElection = await deploy<any>(
    "VerifierElection",
    shared.accessManager,
    await verifierPowerToken.getAddress(),
  );
  const verifierManager = await deploy<any>(
    "VerifierManager",
    shared.accessManager,
    await verifierElection.getAddress(),
    shared.paramController,
  );

  const valuableActionRegistry = await deploy<any>(
    "ValuableActionRegistry",
    shared.accessManager,
    shared.communityRegistry,
    await timelock.getAddress(),
  );
  const valuableActionSBT = await deploy<any>("ValuableActionSBT", shared.accessManager);
  const engagements = await deploy<any>(
    "Engagements",
    shared.accessManager,
    await valuableActionRegistry.getAddress(),
    await verifierManager.getAddress(),
    await valuableActionSBT.getAddress(),
    await membershipToken.getAddress(),
    nextCommunityId,
  );
  const positionManager = await deploy<any>(
    "PositionManager",
    shared.accessManager,
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
  );
  const credentialManager = await deploy<any>(
    "CredentialManager",
    shared.accessManager,
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
  );

  const cohortRegistry = await deploy<any>("CohortRegistry", shared.accessManager);
  const investmentCohortManager = await deploy<any>(
    "InvestmentCohortManager",
    shared.accessManager,
    await cohortRegistry.getAddress(),
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
  );
  const revenueRouter = await deploy<any>(
    "RevenueRouter",
    shared.accessManager,
    shared.paramController,
    await cohortRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
  );

  const communityToken = await deploy<any>(
    "CommunityToken",
    requireAddress(config.treasuryStableToken, "treasuryStableToken"),
    nextCommunityId,
    `${config.communityName} Token`,
    `SCT-${nextCommunityId}`,
    requireAddress(config.treasuryVault, "treasuryVault"),
    ethers.parseEther("1000000"),
    shared.paramController,
    shared.accessManager,
  );

  const treasuryAdapter = await deploy<any>("TreasuryAdapter", shared.accessManager, shared.communityRegistry);
  const requestHub = await deploy<any>(
    "RequestHub",
    shared.communityRegistry,
    await valuableActionRegistry.getAddress(),
  );
  const draftsManager = await deploy<any>(
    "DraftsManager",
    shared.communityRegistry,
    await governor.getAddress(),
    shared.accessManager,
  );
  const commerceDisputes = await deploy<any>("CommerceDisputes", shared.accessManager);
  const marketplace = await deploy<any>(
    "Marketplace",
    shared.accessManager,
    await commerceDisputes.getAddress(),
    await revenueRouter.getAddress(),
  );
  const housingManager = await deploy<any>(
    "HousingManager",
    shared.accessManager,
    requireAddress(config.treasuryStableToken, "treasuryStableToken"),
  );
  const projectFactory = await deploy<any>("ProjectFactory");

  const registerTx = await communityRegistry.registerCommunity(
    config.communityName,
    config.communityDescription,
    config.communityMetadataURI,
    0,
  );
  await registerTx.wait();
  const communityId = Number(await communityRegistry.nextCommunityId()) - 1;

  if (communityId !== nextCommunityId) {
    throw new Error(`Community ID mismatch. predicted=${nextCommunityId} actual=${communityId}`);
  }

  await (await paramController.setVerifierParams(
    communityId,
    config.verifierPanelSize,
    config.verifierMin,
    config.maxPanelsPerEpoch,
    config.useVPTWeighting,
    config.maxWeightPerVerifier,
    config.cooldownAfterFraud,
  )).wait();
  await (await paramController.setGovernanceParams(
    communityId,
    config.votingDelay,
    config.votingPeriod,
    config.executionDelay,
  )).wait();
  await (await paramController.setEligibilityParams(communityId, 0, 0, config.proposalThreshold)).wait();
  await (await paramController.setRevenuePolicy(
    communityId,
    config.minTreasuryBps,
    config.minPositionsBps,
    config.spilloverTarget,
    config.spilloverSplitBpsTreasury,
  )).wait();

  const moduleAddresses = {
    governor: await governor.getAddress(),
    timelock: await timelock.getAddress(),
    requestHub: await requestHub.getAddress(),
    draftsManager: await draftsManager.getAddress(),
    engagementsManager: await engagements.getAddress(),
    valuableActionRegistry: await valuableActionRegistry.getAddress(),
    verifierPowerToken: await verifierPowerToken.getAddress(),
    verifierElection: await verifierElection.getAddress(),
    verifierManager: await verifierManager.getAddress(),
    valuableActionSBT: await valuableActionSBT.getAddress(),
    treasuryVault: config.treasuryVault,
    treasuryAdapter: await treasuryAdapter.getAddress(),
    communityToken: await communityToken.getAddress(),
    paramController: shared.paramController,
  };

  await (await communityRegistry.setModuleAddresses(communityId, moduleAddresses)).wait();

  const addresses: CommunityStackAddresses = {
    ...shared,
    membershipToken: await membershipToken.getAddress(),
    timelock: await timelock.getAddress(),
    governor: await governor.getAddress(),
    countingMultiChoice: await countingMultiChoice.getAddress(),
    verifierPowerToken: await verifierPowerToken.getAddress(),
    verifierElection: await verifierElection.getAddress(),
    verifierManager: await verifierManager.getAddress(),
    valuableActionRegistry: await valuableActionRegistry.getAddress(),
    valuableActionSBT: await valuableActionSBT.getAddress(),
    engagements: await engagements.getAddress(),
    positionManager: await positionManager.getAddress(),
    credentialManager: await credentialManager.getAddress(),
    cohortRegistry: await cohortRegistry.getAddress(),
    investmentCohortManager: await investmentCohortManager.getAddress(),
    revenueRouter: await revenueRouter.getAddress(),
    communityToken: await communityToken.getAddress(),
    treasuryAdapter: await treasuryAdapter.getAddress(),
    requestHub: await requestHub.getAddress(),
    draftsManager: await draftsManager.getAddress(),
    commerceDisputes: await commerceDisputes.getAddress(),
    marketplace: await marketplace.getAddress(),
    housingManager: await housingManager.getAddress(),
    projectFactory: await projectFactory.getAddress(),
  };

  const currentBlock = await ethers.provider.getBlockNumber();
  saveDeploymentFile({
    network: networkName(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    communityId,
    addresses,
    configuration: {
      communityName: config.communityName,
      votingDelay: config.votingDelay,
      votingPeriod: config.votingPeriod,
      executionDelay: config.executionDelay,
      minTreasuryBps: config.minTreasuryBps,
      minPositionsBps: config.minPositionsBps,
      supportedTokens: config.supportedTokens,
    },
    startBlock: currentBlock,
  });

  return { communityId, addresses };
}

export async function wireCommunityRoles(
  communityId: number,
  addresses: CommunityStackAddresses,
  config: CommunityDeployConfig,
): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const accessManager = await ethers.getContractAt("ShiftAccessManager", addresses.accessManager);

  const adminRole = await accessManager.ADMIN_ROLE();

  const timelock = await ethers.getContractAt("ShiftTimelockController", addresses.timelock);
  const governor = await ethers.getContractAt("ShiftGovernor", addresses.governor);
  const verifierPowerToken = await ethers.getContractAt("VerifierPowerToken1155", addresses.verifierPowerToken);
  const verifierElection = await ethers.getContractAt("VerifierElection", addresses.verifierElection);
  const verifierManager = await ethers.getContractAt("VerifierManager", addresses.verifierManager);
  const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", addresses.valuableActionRegistry);
  const valuableActionSBT = await ethers.getContractAt("ValuableActionSBT", addresses.valuableActionSBT);
  const engagements = await ethers.getContractAt("Engagements", addresses.engagements);
  const positionManager = await ethers.getContractAt("PositionManager", addresses.positionManager);
  const credentialManager = await ethers.getContractAt("CredentialManager", addresses.credentialManager);
  const cohortRegistry = await ethers.getContractAt("CohortRegistry", addresses.cohortRegistry);
  const investmentCohortManager = await ethers.getContractAt("InvestmentCohortManager", addresses.investmentCohortManager);
  const revenueRouter = await ethers.getContractAt("RevenueRouter", addresses.revenueRouter);
  const treasuryAdapter = await ethers.getContractAt("TreasuryAdapter", addresses.treasuryAdapter);
  const marketplace = await ethers.getContractAt("Marketplace", addresses.marketplace);
  const housingManager = await ethers.getContractAt("HousingManager", addresses.housingManager);
  const commerceDisputes = await ethers.getContractAt("CommerceDisputes", addresses.commerceDisputes);
  const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", addresses.membershipToken);

  const setRole = async (targetAddress: string, selectors: string[], roleId: bigint) => {
    await (await accessManager.setTargetFunctionRole(targetAddress, selectors, roleId)).wait();
  };

  const grantRole = async (roleId: bigint, account: string) => {
    const has = await accessManager.hasRole(roleId, account);
    if (!has) await (await accessManager.grantRole(roleId, account, 0)).wait();
  };

  await grantRole(adminRole, addresses.timelock);

  await setRole(addresses.valuableActionRegistry, [
    valuableActionRegistry.interface.getFunction("setValuableActionSBT").selector,
    valuableActionRegistry.interface.getFunction("setIssuancePaused").selector,
    valuableActionRegistry.interface.getFunction("setIssuanceModule").selector,
    valuableActionRegistry.interface.getFunction("setCommunityNarrowing").selector,
    valuableActionRegistry.interface.getFunction("setCommunityIssuanceModule").selector,
    valuableActionRegistry.interface.getFunction("setModerator").selector,
    valuableActionRegistry.interface.getFunction("addFounder").selector,
    valuableActionRegistry.interface.getFunction("proposeValuableAction").selector,
    valuableActionRegistry.interface.getFunction("activateFromGovernance").selector,
    valuableActionRegistry.interface.getFunction("update").selector,
    valuableActionRegistry.interface.getFunction("deactivate").selector,
  ], adminRole);

  await setRole(addresses.engagements, [
    engagements.interface.getFunction("revoke").selector,
    engagements.interface.getFunction("updateContracts").selector,
  ], adminRole);

  await setRole(addresses.verifierElection, [
    verifierElection.interface.getFunction("setVerifierSet").selector,
    verifierElection.interface.getFunction("banVerifiers").selector,
    verifierElection.interface.getFunction("unbanVerifier").selector,
    verifierElection.interface.getFunction("adjustVerifierPower").selector,
  ], adminRole);

  await setRole(addresses.verifierManager, [
    verifierManager.interface.getFunction("selectJurors").selector,
    verifierManager.interface.getFunction("reportFraud").selector,
  ], Roles.VERIFIER_MANAGER_CALLER_ROLE);
  await grantRole(Roles.VERIFIER_MANAGER_CALLER_ROLE, addresses.engagements);

  await setRole(addresses.verifierPowerToken, [
    verifierPowerToken.interface.getFunction("mint").selector,
    verifierPowerToken.interface.getFunction("burn").selector,
    verifierPowerToken.interface.getFunction("batchMint").selector,
    verifierPowerToken.interface.getFunction("batchBurn").selector,
  ], VPT_ELECTION_POWER_ROLE);
  await setRole(addresses.verifierPowerToken, [
    verifierPowerToken.interface.getFunction("initializeCommunity").selector,
    verifierPowerToken.interface.getFunction("adminTransfer").selector,
    verifierPowerToken.interface.getFunction("setURI").selector,
  ], adminRole);
  await grantRole(VPT_ELECTION_POWER_ROLE, addresses.verifierElection);

  await setRole(addresses.cohortRegistry, [
    cohortRegistry.interface.getFunction("createCohort").selector,
    cohortRegistry.interface.getFunction("setCohortActive").selector,
  ], adminRole);
  await setRole(addresses.cohortRegistry, [cohortRegistry.interface.getFunction("markRecovered").selector], Roles.COHORT_REVENUE_ROUTER_ROLE);
  await setRole(addresses.cohortRegistry, [cohortRegistry.interface.getFunction("addInvestment").selector], Roles.COHORT_INVESTMENT_RECORDER_ROLE);
  await grantRole(Roles.COHORT_REVENUE_ROUTER_ROLE, addresses.revenueRouter);
  await grantRole(Roles.COHORT_INVESTMENT_RECORDER_ROLE, addresses.investmentCohortManager);

  await setRole(addresses.investmentCohortManager, [
    investmentCohortManager.interface.getFunction("createCohort").selector,
    investmentCohortManager.interface.getFunction("setCohortActive").selector,
    investmentCohortManager.interface.getFunction("issueInvestment").selector,
  ], adminRole);

  await setRole(addresses.positionManager, [
    positionManager.interface.getFunction("setRevenueRouter").selector,
    positionManager.interface.getFunction("definePositionType").selector,
    positionManager.interface.getFunction("approveApplication").selector,
    positionManager.interface.getFunction("closePosition").selector,
  ], adminRole);

  await setRole(addresses.credentialManager, [
    credentialManager.interface.getFunction("defineCourse").selector,
    credentialManager.interface.getFunction("setCourseActive").selector,
    credentialManager.interface.getFunction("revokeCredential").selector,
    credentialManager.interface.getFunction("approveApplication").selector,
  ], adminRole);

  await setRole(addresses.revenueRouter, [
    revenueRouter.interface.getFunction("setCommunityTreasury").selector,
    revenueRouter.interface.getFunction("setSupportedToken").selector,
    revenueRouter.interface.getFunction("setParamController").selector,
    revenueRouter.interface.getFunction("setCohortRegistry").selector,
  ], adminRole);
  await setRole(addresses.revenueRouter, [
    revenueRouter.interface.getFunction("registerPosition").selector,
    revenueRouter.interface.getFunction("unregisterPosition").selector,
  ], Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE);
  await setRole(addresses.revenueRouter, [
    revenueRouter.interface.getFunction("routeRevenue").selector,
  ], Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE);
  await grantRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, addresses.positionManager);
  await grantRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, addresses.marketplace);

  await setRole(addresses.membershipToken, [
    membershipToken.interface.getFunction("mint").selector,
    membershipToken.interface.getFunction("batchMint").selector,
  ], Roles.MEMBERSHIP_TOKEN_MINTER_ROLE);
  await setRole(addresses.membershipToken, [
    membershipToken.interface.getFunction("emergencyBurn").selector,
  ], Roles.MEMBERSHIP_TOKEN_GOVERNANCE_ROLE);
  await grantRole(Roles.MEMBERSHIP_TOKEN_MINTER_ROLE, addresses.engagements);

  await setRole(addresses.valuableActionSBT, [
    valuableActionSBT.interface.getFunction("mintEngagement").selector,
    valuableActionSBT.interface.getFunction("mintPosition").selector,
    valuableActionSBT.interface.getFunction("mintRoleFromPosition").selector,
    valuableActionSBT.interface.getFunction("mintInvestment").selector,
    valuableActionSBT.interface.getFunction("setEndedAt").selector,
    valuableActionSBT.interface.getFunction("closePositionToken").selector,
    valuableActionSBT.interface.getFunction("updateTokenURI").selector,
  ], Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);

  await grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, addresses.valuableActionRegistry);
  await grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, addresses.engagements);
  await grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, addresses.positionManager);
  await grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, addresses.investmentCohortManager);
  await grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, addresses.credentialManager);

  await grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.requestHub);
  await grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.positionManager);
  await grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.investmentCohortManager);
  await grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.credentialManager);

  await setRole(addresses.commerceDisputes, [
    commerceDisputes.interface.getFunction("setDisputeReceiver").selector,
    commerceDisputes.interface.getFunction("finalizeDispute").selector,
    commerceDisputes.interface.getFunction("cancelDispute").selector,
  ], adminRole);
  await setRole(addresses.commerceDisputes, [
    commerceDisputes.interface.getFunction("openDispute").selector,
  ], Roles.COMMERCE_DISPUTES_CALLER_ROLE);
  await grantRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, addresses.marketplace);

  await setRole(addresses.housingManager, [housingManager.interface.getFunction("createUnit").selector], adminRole);
  await setRole(addresses.housingManager, [
    housingManager.interface.getFunction("consume").selector,
    housingManager.interface.getFunction("onOrderSettled").selector,
  ], Roles.HOUSING_MARKETPLACE_CALLER_ROLE);
  await grantRole(Roles.HOUSING_MARKETPLACE_CALLER_ROLE, addresses.marketplace);

  await setRole(addresses.marketplace, [
    marketplace.interface.getFunction("setCommunityActive").selector,
    marketplace.interface.getFunction("setCommunityToken").selector,
    marketplace.interface.getFunction("setCommerceDisputes").selector,
    marketplace.interface.getFunction("setRevenueRouter").selector,
  ], adminRole);

  await setRole(addresses.treasuryAdapter, [
    treasuryAdapter.interface.getFunction("setTokenAllowed").selector,
    treasuryAdapter.interface.getFunction("setDestinationAllowed").selector,
    treasuryAdapter.interface.getFunction("setVaultAdapterAllowed").selector,
    treasuryAdapter.interface.getFunction("setCapBps").selector,
  ], adminRole);

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const cancellerRole = await timelock.CANCELLER_ROLE();
  const defaultAdminRole = await timelock.DEFAULT_ADMIN_ROLE();
  await (await timelock.grantRole(proposerRole, addresses.governor)).wait();
  await (await timelock.grantRole(executorRole, addresses.governor)).wait();
  await (await timelock.grantRole(cancellerRole, addresses.governor)).wait();

  if ((await governor.multiCounter()) === ethers.ZeroAddress) {
    console.warn("⚠️ Governor multiCounter is unset. Initialize via governance proposal execution.");
  }

  await (await verifierPowerToken.initializeCommunity(communityId, config.vptMetadataURI)).wait();

  await (await valuableActionRegistry.setValuableActionSBT(addresses.valuableActionSBT)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.requestHub, true)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.positionManager, true)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.investmentCohortManager, true)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.credentialManager, true)).wait();
  await (await valuableActionRegistry.addFounder(config.founderAddress, communityId)).wait();

  await (await positionManager.setRevenueRouter(addresses.revenueRouter)).wait();
  await (await revenueRouter.setCommunityTreasury(communityId, config.treasuryVault)).wait();
  for (const token of config.supportedTokens) {
    await (await revenueRouter.setSupportedToken(communityId, token, true)).wait();
    await (await treasuryAdapter.setTokenAllowed(communityId, token, true)).wait();
    await (await treasuryAdapter.setCapBps(communityId, token, 1000)).wait();
  }
  await (await treasuryAdapter.setDestinationAllowed(communityId, addresses.requestHub, true)).wait();

  await (await commerceDisputes.setDisputeReceiver(addresses.marketplace)).wait();
  await (await marketplace.setCommunityActive(communityId, true)).wait();
  await (await marketplace.setCommunityToken(communityId, addresses.communityToken)).wait();

  if (config.initialMembershipTokens > 0n) {
    await grantRole(Roles.MEMBERSHIP_TOKEN_MINTER_ROLE, deployer.address);
    await (await membershipToken.mint(config.founderAddress, config.initialMembershipTokens, "Founder bootstrap")).wait();
    await (await accessManager.revokeRole(Roles.MEMBERSHIP_TOKEN_MINTER_ROLE, deployer.address)).wait();
  }

  if (await accessManager.hasRole(adminRole, deployer.address)) {
    await (await accessManager.revokeRole(adminRole, deployer.address)).wait();
  }
  await (await timelock.renounceRole(defaultAdminRole, deployer.address)).wait();
}

export async function verifyCommunityDeployment(communityId: number, addresses: CommunityStackAddresses): Promise<void> {
  const accessManager = await ethers.getContractAt("AccessManager", addresses.accessManager);
  const verifierPowerToken = await ethers.getContractAt("VerifierPowerToken1155", addresses.verifierPowerToken);
  const revenueRouter = await ethers.getContractAt("RevenueRouter", addresses.revenueRouter);
  const marketplace = await ethers.getContractAt("Marketplace", addresses.marketplace);
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", addresses.communityRegistry);

  const modules = await communityRegistry.getCommunityModules(communityId);
  if (modules.valuableActionRegistry.toLowerCase() !== addresses.valuableActionRegistry.toLowerCase()) {
    throw new Error("CommunityRegistry module wiring mismatch for ValuableActionRegistry");
  }
  if (modules.marketplace && modules.marketplace !== undefined) {
    // no-op: older ABI may not expose this field
  }

  if (!(await verifierPowerToken.communityInitialized(communityId))) {
    throw new Error("VerifierPowerToken community is not initialized");
  }

  const rrPosRole = await accessManager.hasRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, addresses.positionManager);
  if (!rrPosRole) throw new Error("PositionManager missing REVENUE_ROUTER_POSITION_MANAGER_ROLE");

  const rrDistRole = await accessManager.hasRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, addresses.marketplace);
  if (!rrDistRole) throw new Error("Marketplace missing REVENUE_ROUTER_DISTRIBUTOR_ROLE");

  const disputesCaller = await accessManager.hasRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, addresses.marketplace);
  if (!disputesCaller) throw new Error("Marketplace missing COMMERCE_DISPUTES_CALLER_ROLE");

  const housingCaller = await accessManager.hasRole(Roles.HOUSING_MARKETPLACE_CALLER_ROLE, addresses.marketplace);
  if (!housingCaller) throw new Error("Marketplace missing HOUSING_MARKETPLACE_CALLER_ROLE");

  const issuerRole = await accessManager.hasRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.requestHub);
  if (!issuerRole) throw new Error("RequestHub missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE");

  if (!(await marketplace.communityActive(communityId))) {
    throw new Error("Marketplace not activated for community");
  }

  if ((await revenueRouter.communityTreasuries(communityId)).toLowerCase() === ethers.ZeroAddress) {
    throw new Error("RevenueRouter treasury is not set");
  }
}
