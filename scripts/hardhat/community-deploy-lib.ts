import fs from "fs";
import path from "path";
import hre from "hardhat";
import { Roles } from "../roles";

const { ethers, network } = hre;

export type SharedInfra = {
  paramController: string;
  communityRegistry: string;
  bootstrapCoordinator: string;
  governanceLayerFactory: string;
  verificationLayerFactory: string;
  economicLayerFactory: string;
  commerceLayerFactory: string;
  coordinationLayerFactory: string;
};

export type CommunityStackAddresses = SharedInfra & {
  accessManager: string;
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

export type TxOverrides = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

let deploymentSignerPromise: Promise<any> | null = null;

function gwei(value: string): bigint {
  return ethers.parseUnits(value, "gwei");
}

const BASE_SEPOLIA_MAX_FEE_CAP_GWEI = "0.1";
const BASE_SEPOLIA_PRIORITY_CAP_GWEI = "0.02";

function assertBaseSepoliaFeeCaps(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint): void {
  if (networkName() !== "base_sepolia") return;

  const maxFeeCap = gwei(BASE_SEPOLIA_MAX_FEE_CAP_GWEI);
  const priorityCap = gwei(BASE_SEPOLIA_PRIORITY_CAP_GWEI);

  if (maxFeePerGas > maxFeeCap || maxPriorityFeePerGas > priorityCap) {
    throw new Error(
      `Refusing high gas config on base_sepolia. maxFeePerGas<=${BASE_SEPOLIA_MAX_FEE_CAP_GWEI} gwei and maxPriorityFeePerGas<=${BASE_SEPOLIA_PRIORITY_CAP_GWEI} gwei required.`,
    );
  }
}

function getTxOverrides(): TxOverrides {
  const maxFee = process.env.MAX_FEE_PER_GAS_GWEI;
  const maxPriority = process.env.MAX_PRIORITY_FEE_PER_GAS_GWEI;

  // Prefer provider-managed fee estimation when no explicit overrides are supplied.
  if (!maxFee && !maxPriority) return {};

  const resolvedMaxFee = maxFee ? gwei(maxFee) : undefined;
  const resolvedPriority = maxPriority ? gwei(maxPriority) : undefined;

  if (resolvedMaxFee !== undefined && resolvedPriority !== undefined) {
    assertBaseSepoliaFeeCaps(resolvedMaxFee, resolvedPriority);
  }

  if (resolvedMaxFee !== undefined && resolvedPriority === undefined) {
    assertBaseSepoliaFeeCaps(resolvedMaxFee, 0n);
  }

  if (resolvedMaxFee === undefined && resolvedPriority !== undefined) {
    assertBaseSepoliaFeeCaps(0n, resolvedPriority);
  }

  return {
    ...(resolvedMaxFee !== undefined ? { maxFeePerGas: resolvedMaxFee } : {}),
    ...(resolvedPriority !== undefined ? { maxPriorityFeePerGas: resolvedPriority } : {}),
  };
}

async function getDeploymentSigner(): Promise<any> {
  if (!deploymentSignerPromise) {
    deploymentSignerPromise = (async () => {
      const [baseSigner] = await ethers.getSigners();
      const signer: any = new ethers.NonceManager(baseSigner);
      // Some ethers versions do not expose setTransactionCount on NonceManager.
      // Resetting before each write phase is the authoritative nonce sync path.
      if (typeof signer.setTransactionCount === "function") {
        const pendingNonce = await ethers.provider.getTransactionCount(await baseSigner.getAddress(), "pending");
        signer.setTransactionCount(pendingNonce);
      }
      return signer;
    })();
  }
  return deploymentSignerPromise;
}

async function syncDeploymentSignerNonce(): Promise<void> {
  const signer = await getDeploymentSigner();
  // NonceManager caches locally; reset ensures external txs are reflected.
  if (typeof signer.reset === "function") {
    signer.reset();
  }

  if (typeof signer.setTransactionCount === "function") {
    const addr = await signer.getAddress();
    const pendingNonce = await ethers.provider.getTransactionCount(addr, "pending");
    signer.setTransactionCount(pendingNonce);
  }
}

export type CommunityModuleAddresses = {
  governor: string;
  timelock: string;
  requestHub: string;
  draftsManager: string;
  engagementsManager: string;
  valuableActionRegistry: string;
  verifierPowerToken: string;
  verifierElection: string;
  verifierManager: string;
  valuableActionSBT: string;
  treasuryVault: string;
  treasuryAdapter: string;
  communityToken: string;
  paramController: string;
};

const DEPLOYMENTS_DIR = path.join(process.cwd(), "deployments");
const VPT_ELECTION_POWER_ROLE = 1001n;
const STRICT_STAGING_NETWORKS = new Set(["base_sepolia", "hardhat"]);
const LEGACY_MODE_ENV_FLAGS = [
  "SHIFT_ENABLE_LEGACY_DEPLOY",
  "SHIFT_ENABLE_BACKFILL",
  "SHIFT_ENABLE_MIXED_MODE"
] as const;

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function assertStrictStagingMode(net: string): void {
  if (!STRICT_STAGING_NETWORKS.has(net)) {
    throw new Error(
      `Strict staging mode only supports ${Array.from(STRICT_STAGING_NETWORKS).join(", ")}. Received network=${net}.`
    );
  }

  const enabledLegacyFlags = LEGACY_MODE_ENV_FLAGS.filter((flag) =>
    isTruthyEnvFlag(process.env[flag])
  );
  if (enabledLegacyFlags.length > 0) {
    throw new Error(
      `Legacy deploy modes are disabled in strict staging mode. Unset: ${enabledLegacyFlags.join(", ")}.`
    );
  }
}

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
  const signer = await getDeploymentSigner();
  const txOverrides = getTxOverrides();
  const factory = await ethers.getContractFactory(factoryName);
  const contract = await factory.connect(signer).deploy(...args, txOverrides);
  await contract.waitForDeployment();
  return contract as any;
}

async function deployTimelockController(...args: any[]): Promise<any> {
  const signer = await getDeploymentSigner();
  const txOverrides = getTxOverrides();
  const factory = await ethers.getContractFactory("ShiftTimelockController");
  const timelock = await factory.connect(signer).deploy(...args, txOverrides);
  await timelock.waitForDeployment();
  return timelock;
}

async function deployAccessManager(admin: string): Promise<any> {
  const signer = await getDeploymentSigner();
  const txOverrides = getTxOverrides();
  const factory = await ethers.getContractFactory("ShiftAccessManager");
  const accessManager = await factory.connect(signer).deploy(admin, txOverrides);
  await accessManager.waitForDeployment();
  return accessManager;
}

async function isUsableSharedInfra(addresses: Partial<SharedInfra>): Promise<boolean> {
  if (
    !addresses.paramController ||
    !addresses.communityRegistry ||
    !addresses.bootstrapCoordinator ||
    !addresses.governanceLayerFactory ||
    !addresses.verificationLayerFactory ||
    !addresses.economicLayerFactory ||
    !addresses.commerceLayerFactory ||
    !addresses.coordinationLayerFactory
  ) {
    return false;
  }

  try {
    const paramControllerCode = await ethers.provider.getCode(addresses.paramController);
    const communityRegistryCode = await ethers.provider.getCode(addresses.communityRegistry);
    const bootstrapCoordinatorCode = await ethers.provider.getCode(addresses.bootstrapCoordinator);
    const governanceLayerFactoryCode = await ethers.provider.getCode(addresses.governanceLayerFactory);
    const verificationLayerFactoryCode = await ethers.provider.getCode(addresses.verificationLayerFactory);
    const economicLayerFactoryCode = await ethers.provider.getCode(addresses.economicLayerFactory);
    const commerceLayerFactoryCode = await ethers.provider.getCode(addresses.commerceLayerFactory);
    const coordinationLayerFactoryCode = await ethers.provider.getCode(addresses.coordinationLayerFactory);

    if (
      paramControllerCode === "0x" ||
      communityRegistryCode === "0x" ||
      bootstrapCoordinatorCode === "0x" ||
      governanceLayerFactoryCode === "0x" ||
      verificationLayerFactoryCode === "0x" ||
      economicLayerFactoryCode === "0x" ||
      commerceLayerFactoryCode === "0x" ||
      coordinationLayerFactoryCode === "0x"
    ) {
      return false;
    }

    const paramController = await ethers.getContractAt("ParamController", addresses.paramController);
    const communityRegistry = await ethers.getContractAt("CommunityRegistry", addresses.communityRegistry);

    // Probe read-only calls to ensure ABI/runtime compatibility, not just non-empty bytecode.
    const wiredRegistry = await paramController.communityRegistry();
    await communityRegistry.nextCommunityId();
    if (wiredRegistry.toLowerCase() !== addresses.communityRegistry.toLowerCase()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function deploySharedInfraIfMissing(): Promise<SharedInfra> {
  const net = networkName();
  assertStrictStagingMode(net);
  const forceRedeploySharedInfra = process.env.SHIFT_FORCE_REDEPLOY_SHARED_INFRA === "1";
  const existing = net === "hardhat" ? null : loadDeploymentFile(net);
  const existingShared: Partial<SharedInfra> = {
    paramController: existing?.addresses?.paramController,
    communityRegistry: existing?.addresses?.communityRegistry,
    bootstrapCoordinator: existing?.addresses?.bootstrapCoordinator,
    governanceLayerFactory: existing?.addresses?.governanceLayerFactory,
    verificationLayerFactory: existing?.addresses?.verificationLayerFactory,
    economicLayerFactory: existing?.addresses?.economicLayerFactory,
    commerceLayerFactory: existing?.addresses?.commerceLayerFactory,
    coordinationLayerFactory: existing?.addresses?.coordinationLayerFactory,
  };

  if (!forceRedeploySharedInfra && await isUsableSharedInfra(existingShared)) {
    return {
      paramController: existingShared.paramController!,
      communityRegistry: existingShared.communityRegistry!,
      bootstrapCoordinator: existingShared.bootstrapCoordinator!,
      governanceLayerFactory: existingShared.governanceLayerFactory!,
      verificationLayerFactory: existingShared.verificationLayerFactory!,
      economicLayerFactory: existingShared.economicLayerFactory!,
      commerceLayerFactory: existingShared.commerceLayerFactory!,
      coordinationLayerFactory: existingShared.coordinationLayerFactory!,
    };
  }

  if (forceRedeploySharedInfra) {
    console.warn("⚠️ SHIFT_FORCE_REDEPLOY_SHARED_INFRA=1 set. Redeploying shared infra and overwriting deployment JSON addresses.");
  }

  if (existing?.addresses?.paramController || existing?.addresses?.communityRegistry) {
    console.warn(
      "⚠️ Existing shared infra addresses are missing or invalid on current network. Redeploying shared infra and overwriting deployment JSON.",
    );
  }

  const signer = await getDeploymentSigner();
  const deployer = await signer.getAddress();
  const txOverrides = getTxOverrides();

  const paramController = await deploy<any>("ParamController", deployer);
  const communityRegistry = await deploy<any>(
    "CommunityRegistry",
    await paramController.getAddress(),
  );
  const bootstrapCoordinator = await deploy<any>("BootstrapCoordinator");
  const governanceLayerFactory = await deploy<any>("GovernanceLayerFactory");
  const verificationLayerFactory = await deploy<any>("VerificationLayerFactory");
  const economicLayerFactory = await deploy<any>("EconomicLayerFactory");
  const commerceLayerFactory = await deploy<any>("CommerceLayerFactory");
  const coordinationLayerFactory = await deploy<any>("CoordinationLayerFactory");
  await (await paramController.setCommunityRegistry(await communityRegistry.getAddress(), txOverrides)).wait();

  const currentBlock = await ethers.provider.getBlockNumber();
  const merged = {
    ...(existing ?? {
      network: networkName(),
      timestamp: new Date().toISOString(),
      deployer,
      addresses: {},
    }),
    timestamp: new Date().toISOString(),
    deployer,
    addresses: {
      ...(existing?.addresses ?? {}),
      paramController: await paramController.getAddress(),
      communityRegistry: await communityRegistry.getAddress(),
      bootstrapCoordinator: await bootstrapCoordinator.getAddress(),
      governanceLayerFactory: await governanceLayerFactory.getAddress(),
      verificationLayerFactory: await verificationLayerFactory.getAddress(),
      economicLayerFactory: await economicLayerFactory.getAddress(),
      commerceLayerFactory: await commerceLayerFactory.getAddress(),
      coordinationLayerFactory: await coordinationLayerFactory.getAddress(),
    },
    startBlock: existing?.startBlock ?? currentBlock,
  } as DeploymentJson;

  saveDeploymentFile(merged, net);

  return {
    paramController: await paramController.getAddress(),
    communityRegistry: await communityRegistry.getAddress(),
    bootstrapCoordinator: await bootstrapCoordinator.getAddress(),
    governanceLayerFactory: await governanceLayerFactory.getAddress(),
    verificationLayerFactory: await verificationLayerFactory.getAddress(),
    economicLayerFactory: await economicLayerFactory.getAddress(),
    commerceLayerFactory: await commerceLayerFactory.getAddress(),
    coordinationLayerFactory: await coordinationLayerFactory.getAddress(),
  };
}

export async function registerAndConfigureCommunity(
  communityRegistryAddress: string,
  paramControllerAddress: string,
  config: CommunityDeployConfig,
  moduleAddresses: CommunityModuleAddresses,
  expectedCommunityId?: number,
  txOverrides: TxOverrides = {},
): Promise<number> {
  await syncDeploymentSignerNonce();
  const signer = await getDeploymentSigner();
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", communityRegistryAddress, signer);
  const paramController = await ethers.getContractAt("ParamController", paramControllerAddress, signer);

  const registerTx = await communityRegistry.registerCommunity(
    config.communityName,
    config.communityDescription,
    config.communityMetadataURI,
    0,
    txOverrides,
  );
  const registerReceipt = await registerTx.wait();

  let communityId: number | null = null;
  for (const log of registerReceipt.logs ?? []) {
    try {
      const parsed = communityRegistry.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "CommunityRegistered") {
        communityId = Number(parsed.args.communityId);
        break;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  if (communityId === null) {
    communityId = Number(await communityRegistry.nextCommunityId()) - 1;
  }

  if (expectedCommunityId !== undefined && communityId !== expectedCommunityId) {
    const observedNext = Number(await communityRegistry.nextCommunityId());
    throw new Error(
      `Community ID mismatch. predicted=${expectedCommunityId} actual=${communityId} observedNext=${observedNext}`,
    );
  }

  await (await paramController.setVerifierParams(
    communityId,
    config.verifierPanelSize,
    config.verifierMin,
    config.maxPanelsPerEpoch,
    config.useVPTWeighting,
    config.maxWeightPerVerifier,
    config.cooldownAfterFraud,
    txOverrides,
  )).wait();
  await (await paramController.setGovernanceParams(
    communityId,
    config.votingDelay,
    config.votingPeriod,
    config.executionDelay,
    txOverrides,
  )).wait();
  await (await paramController.setEligibilityParams(communityId, 0, 0, config.proposalThreshold, txOverrides)).wait();
  await (await paramController.setRevenuePolicy(
    communityId,
    config.minTreasuryBps,
    config.minPositionsBps,
    config.spilloverTarget,
    config.spilloverSplitBpsTreasury,
    txOverrides,
  )).wait();

  const moduleEntries: Array<[string, string]> = [
    ["governor", moduleAddresses.governor],
    ["timelock", moduleAddresses.timelock],
    ["requestHub", moduleAddresses.requestHub],
    ["draftsManager", moduleAddresses.draftsManager],
    ["engagementsManager", moduleAddresses.engagementsManager],
    ["valuableActionRegistry", moduleAddresses.valuableActionRegistry],
    ["verifierPowerToken", moduleAddresses.verifierPowerToken],
    ["verifierElection", moduleAddresses.verifierElection],
    ["verifierManager", moduleAddresses.verifierManager],
    ["valuableActionSBT", moduleAddresses.valuableActionSBT],
    ["treasuryVault", moduleAddresses.treasuryVault],
    ["treasuryAdapter", moduleAddresses.treasuryAdapter],
    ["communityToken", moduleAddresses.communityToken],
    ["paramController", moduleAddresses.paramController],
  ];

  for (const [key, value] of moduleEntries) {
    if (value && value !== ethers.ZeroAddress) {
      await (await communityRegistry.setModuleAddress(communityId, ethers.id(key), value, txOverrides)).wait();
    }
  }

  const wiredTimelock = await communityRegistry.getTimelock(communityId);
  if (wiredTimelock.toLowerCase() !== moduleAddresses.timelock.toLowerCase()) {
    throw new Error(
      `Timelock wiring mismatch for community ${communityId}. expected=${moduleAddresses.timelock} actual=${wiredTimelock}`,
    );
  }

  return communityId;
}

export async function deployCommunityStack(config: CommunityDeployConfig): Promise<{ communityId: number; addresses: CommunityStackAddresses }> {
  assertStrictStagingMode(networkName());
  const signer = await getDeploymentSigner();
  const deployer = await signer.getAddress();
  const txOverrides = getTxOverrides();
  const shared = await deploySharedInfraIfMissing();
  const accessManager = await deployAccessManager(deployer);
  const accessManagerAddress = await accessManager.getAddress();

  const communityRegistry = await ethers.getContractAt("CommunityRegistry", shared.communityRegistry, signer);
  const nextCommunityId = Number(await communityRegistry.nextCommunityId());

  const membershipToken = await deploy<any>(
    "MembershipTokenERC20Votes",
    `${config.communityName} Membership`,
    `sMEM-${nextCommunityId}`,
    nextCommunityId,
    accessManagerAddress,
  );

  const timelock = await deployTimelockController(
    config.executionDelay,
    [],
    [],
    deployer,
  );

  const governor = await deploy<any>(
    "ShiftGovernor",
    await membershipToken.getAddress(),
    accessManagerAddress,
    config.executionDelay,
  );

  const countingMultiChoice = await deploy<any>("CountingMultiChoice", await governor.getAddress());

  const verifierPowerToken = await deploy<any>("VerifierPowerToken1155", accessManagerAddress, "", nextCommunityId);
  const verifierElection = await deploy<any>(
    "VerifierElection",
    accessManagerAddress,
    await verifierPowerToken.getAddress(),
    nextCommunityId,
  );
  const verifierManager = await deploy<any>(
    "VerifierManager",
    accessManagerAddress,
    await verifierElection.getAddress(),
    shared.paramController,
    nextCommunityId,
  );

  const valuableActionRegistry = await deploy<any>(
    "ValuableActionRegistry",
    accessManagerAddress,
    shared.communityRegistry,
    await timelock.getAddress(),
    nextCommunityId,
  );
  const valuableActionSBT = await deploy<any>("ValuableActionSBT", accessManagerAddress, nextCommunityId);
  const engagements = await deploy<any>(
    "Engagements",
    accessManagerAddress,
    await valuableActionRegistry.getAddress(),
    await verifierManager.getAddress(),
    await valuableActionSBT.getAddress(),
    await membershipToken.getAddress(),
    nextCommunityId,
  );
  const positionManager = await deploy<any>(
    "PositionManager",
    accessManagerAddress,
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
    nextCommunityId,
  );
  const credentialManager = await deploy<any>(
    "CredentialManager",
    accessManagerAddress,
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
    nextCommunityId,
  );

  const cohortRegistry = await deploy<any>("CohortRegistry", accessManagerAddress, nextCommunityId);
  const investmentCohortManager = await deploy<any>(
    "InvestmentCohortManager",
    accessManagerAddress,
    await cohortRegistry.getAddress(),
    await valuableActionRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
    nextCommunityId,
  );
  const revenueRouter = await deploy<any>(
    "RevenueRouter",
    accessManagerAddress,
    shared.paramController,
    await cohortRegistry.getAddress(),
    await valuableActionSBT.getAddress(),
    nextCommunityId,
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
    accessManagerAddress,
  );

  const treasuryAdapter = await deploy<any>("TreasuryAdapter", accessManagerAddress, shared.communityRegistry, nextCommunityId);
  const requestHub = await deploy<any>(
    "RequestHub",
    shared.communityRegistry,
    await valuableActionRegistry.getAddress(),
  );
  const draftsManager = await deploy<any>(
    "DraftsManager",
    shared.communityRegistry,
    await governor.getAddress(),
    accessManagerAddress,
    nextCommunityId,
  );
  const commerceDisputes = await deploy<any>("CommerceDisputes", accessManagerAddress, nextCommunityId);
  const marketplace = await deploy<any>(
    "Marketplace",
    accessManagerAddress,
    await commerceDisputes.getAddress(),
    await revenueRouter.getAddress(),
    nextCommunityId,
  );
  const housingManager = await deploy<any>(
    "HousingManager",
    accessManagerAddress,
    requireAddress(config.treasuryStableToken, "treasuryStableToken"),
    nextCommunityId,
  );
  const projectFactory = await deploy<any>("ProjectFactory", nextCommunityId);

  const moduleAddresses: CommunityModuleAddresses = {
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

  const communityId = await registerAndConfigureCommunity(
    shared.communityRegistry,
    shared.paramController,
    config,
    moduleAddresses,
    nextCommunityId,
    txOverrides,
  );

  const addresses: CommunityStackAddresses = {
    ...shared,
    accessManager: accessManagerAddress,
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
    deployer,
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
  assertStrictStagingMode(networkName());
  await syncDeploymentSignerNonce();
  const signer = await getDeploymentSigner();
  const deployer = await signer.getAddress();
  const txOverrides = getTxOverrides();
  const accessManager = await ethers.getContractAt("ShiftAccessManager", addresses.accessManager, signer);

  const adminRole = await accessManager.ADMIN_ROLE();

  const timelock = await ethers.getContractAt("ShiftTimelockController", addresses.timelock, signer);
  const governor = await ethers.getContractAt("ShiftGovernor", addresses.governor, signer);
  const verifierPowerToken = await ethers.getContractAt("VerifierPowerToken1155", addresses.verifierPowerToken, signer);
  const verifierElection = await ethers.getContractAt("VerifierElection", addresses.verifierElection, signer);
  const verifierManager = await ethers.getContractAt("VerifierManager", addresses.verifierManager, signer);
  const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", addresses.valuableActionRegistry, signer);
  const valuableActionSBT = await ethers.getContractAt("ValuableActionSBT", addresses.valuableActionSBT, signer);
  const engagements = await ethers.getContractAt("Engagements", addresses.engagements, signer);
  const positionManager = await ethers.getContractAt("PositionManager", addresses.positionManager, signer);
  const credentialManager = await ethers.getContractAt("CredentialManager", addresses.credentialManager, signer);
  const cohortRegistry = await ethers.getContractAt("CohortRegistry", addresses.cohortRegistry, signer);
  const investmentCohortManager = await ethers.getContractAt("InvestmentCohortManager", addresses.investmentCohortManager, signer);
  const revenueRouter = await ethers.getContractAt("RevenueRouter", addresses.revenueRouter, signer);
  const treasuryAdapter = await ethers.getContractAt("TreasuryAdapter", addresses.treasuryAdapter, signer);
  const marketplace = await ethers.getContractAt("Marketplace", addresses.marketplace, signer);
  const housingManager = await ethers.getContractAt("HousingManager", addresses.housingManager, signer);
  const commerceDisputes = await ethers.getContractAt("CommerceDisputes", addresses.commerceDisputes, signer);
  const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", addresses.membershipToken, signer);

  const setRole = async (targetAddress: string, selectors: string[], roleId: bigint) => {
    await (await accessManager.setTargetFunctionRole(targetAddress, selectors, roleId, txOverrides)).wait();
  };

  const grantRole = async (roleId: bigint, account: string) => {
    const [hasRole] = await accessManager.hasRole(roleId, account);
    if (!hasRole) await (await accessManager.grantRole(roleId, account, 0, txOverrides)).wait();
  };

  await grantRole(adminRole, addresses.timelock);

  await setRole(addresses.valuableActionRegistry, [
    valuableActionRegistry.interface.getFunction("setValuableActionSBT").selector,
    valuableActionRegistry.interface.getFunction("setIssuancePaused").selector,
    valuableActionRegistry.interface.getFunction("setIssuanceModule").selector,
    valuableActionRegistry.interface.getFunction("setCommunityNarrowing").selector,
    valuableActionRegistry.interface.getFunction("setCommunityIssuanceModule").selector,
    valuableActionRegistry.interface.getFunction("addFounder").selector,
    valuableActionRegistry.interface.getFunction("proposeValuableAction").selector,
    valuableActionRegistry.interface.getFunction("activateFromGovernance").selector,
    valuableActionRegistry.interface.getFunction("update").selector,
    valuableActionRegistry.interface.getFunction("deactivate").selector,
  ], adminRole);

  await setRole(addresses.valuableActionRegistry, [
    valuableActionRegistry.interface.getFunction("setModerator").selector,
  ], Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE);

  await setRole(addresses.valuableActionRegistry, [
    valuableActionRegistry.interface.getFunction("issueEngagement").selector,
    valuableActionRegistry.interface.getFunction("issuePosition").selector,
    valuableActionRegistry.interface.getFunction("issueInvestment").selector,
    valuableActionRegistry.interface.getFunction("closePositionToken").selector,
    valuableActionRegistry.interface.getFunction("issueRoleFromPosition").selector,
  ], Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE);

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
  ], adminRole);
  await setRole(addresses.credentialManager, [
    credentialManager.interface.getFunction("approveApplication").selector,
  ], Roles.CREDENTIAL_MANAGER_APPROVER_ROLE);

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
  await grantRole(Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE, addresses.timelock);

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
  await (await timelock.grantRole(proposerRole, addresses.governor, txOverrides)).wait();
  await (await timelock.grantRole(executorRole, addresses.governor, txOverrides)).wait();
  await (await timelock.grantRole(cancellerRole, addresses.governor, txOverrides)).wait();

  if ((await governor.multiCounter()) === ethers.ZeroAddress) {
    console.warn("⚠️ Governor multiCounter is unset. Initialize via governance proposal execution.");
  }

  try {
    await (await verifierPowerToken["initializeCommunity(string)"](config.vptMetadataURI, txOverrides)).wait();
  } catch {
    // Backward compatibility for legacy ABI variants that still include communityId.
    await (await verifierPowerToken.initializeCommunity(communityId, config.vptMetadataURI, txOverrides)).wait();
  }

  await (await valuableActionRegistry.setValuableActionSBT(addresses.valuableActionSBT, txOverrides)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.requestHub, true, txOverrides)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.positionManager, true, txOverrides)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.investmentCohortManager, true, txOverrides)).wait();
  await (await valuableActionRegistry.setIssuanceModule(addresses.credentialManager, true, txOverrides)).wait();
  await (await valuableActionRegistry.addFounder(config.founderAddress, txOverrides)).wait();

  await (await positionManager.setRevenueRouter(addresses.revenueRouter, txOverrides)).wait();
  await (await revenueRouter.setCommunityTreasury(communityId, config.treasuryVault, txOverrides)).wait();
  for (const token of config.supportedTokens) {
    await (await revenueRouter.setSupportedToken(communityId, token, true, txOverrides)).wait();
    await (await treasuryAdapter.setTokenAllowed(token, true, txOverrides)).wait();
    await (await treasuryAdapter.setCapBps(token, 1000, txOverrides)).wait();
  }
  await (await treasuryAdapter.setDestinationAllowed(addresses.requestHub, true, txOverrides)).wait();

  await (await commerceDisputes.setDisputeReceiver(addresses.marketplace, txOverrides)).wait();
  await (await marketplace.setCommunityActive(communityId, true, txOverrides)).wait();
  await (await marketplace.setCommunityToken(communityId, addresses.communityToken, txOverrides)).wait();

  if (config.initialMembershipTokens > 0n) {
    await grantRole(Roles.MEMBERSHIP_TOKEN_MINTER_ROLE, deployer);
    await (await membershipToken.mint(config.founderAddress, config.initialMembershipTokens, "Founder bootstrap", txOverrides)).wait();
    await (await accessManager.revokeRole(Roles.MEMBERSHIP_TOKEN_MINTER_ROLE, deployer, txOverrides)).wait();
  }

  const [deployerHasAdminBeforeRevoke] = await accessManager.hasRole(adminRole, deployer);
  if (deployerHasAdminBeforeRevoke) {
    await (await accessManager.revokeRole(adminRole, deployer, txOverrides)).wait();
  }

  const [deployerHasAdminAfterRevoke] = await accessManager.hasRole(adminRole, deployer);
  if (deployerHasAdminAfterRevoke) {
    throw new Error("AccessManager handoff failed: deployer still has admin role");
  }
  const [timelockHasAdmin] = await accessManager.hasRole(adminRole, addresses.timelock);
  if (!timelockHasAdmin) {
    throw new Error("AccessManager handoff failed: timelock missing admin role");
  }

  await (await timelock.renounceRole(defaultAdminRole, deployer, txOverrides)).wait();
  if (await timelock.hasRole(defaultAdminRole, deployer)) {
    throw new Error("Timelock handoff failed: deployer still has DEFAULT_ADMIN_ROLE");
  }
}

export async function verifyCommunityDeployment(communityId: number, addresses: CommunityStackAddresses): Promise<void> {
  assertStrictStagingMode(networkName());
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

  let isCommunityInitialized = false;
  try {
    isCommunityInitialized = await verifierPowerToken.communityInitialized();
  } catch {
    // Backward compatibility for legacy ABI variants keyed by communityId.
    isCommunityInitialized = await verifierPowerToken.communityInitialized(communityId);
  }
  if (!isCommunityInitialized) {
    throw new Error("VerifierPowerToken community is not initialized");
  }

  const [rrPosRole] = await accessManager.hasRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, addresses.positionManager);
  if (!rrPosRole) throw new Error("PositionManager missing REVENUE_ROUTER_POSITION_MANAGER_ROLE");

  const [rrDistRole] = await accessManager.hasRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, addresses.marketplace);
  if (!rrDistRole) throw new Error("Marketplace missing REVENUE_ROUTER_DISTRIBUTOR_ROLE");

  const [disputesCaller] = await accessManager.hasRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, addresses.marketplace);
  if (!disputesCaller) throw new Error("Marketplace missing COMMERCE_DISPUTES_CALLER_ROLE");

  const [housingCaller] = await accessManager.hasRole(Roles.HOUSING_MARKETPLACE_CALLER_ROLE, addresses.marketplace);
  if (!housingCaller) throw new Error("Marketplace missing HOUSING_MARKETPLACE_CALLER_ROLE");

  const [issuerRole] = await accessManager.hasRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, addresses.requestHub);
  if (!issuerRole) throw new Error("RequestHub missing VALUABLE_ACTION_REGISTRY_ISSUER_ROLE");

  if (!(await marketplace.communityActive(communityId))) {
    throw new Error("Marketplace not activated for community");
  }

  if ((await revenueRouter.communityTreasuries(communityId)).toLowerCase() === ethers.ZeroAddress) {
    throw new Error("RevenueRouter treasury is not set");
  }
}
