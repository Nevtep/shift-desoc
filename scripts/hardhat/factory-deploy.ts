import hre from "hardhat";
import {
  CommunityModuleAddresses,
  CommunityDeployConfig,
  CommunityStackAddresses,
  defaultCommunityDeployConfig,
  deploySharedInfraIfMissing,
  loadDeploymentFile,
  registerAndConfigureCommunity,
  saveDeploymentFile,
} from "./community-deploy-lib";

const { ethers, network } = hre;

type TxOverrides = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

type FactoryInfra = {
  governanceLayerFactory: string;
  verificationLayerFactory: string;
  economicLayerFactory: string;
  commerceLayerFactory: string;
  coordinationLayerFactory: string;
};

async function sumGasUsedBetween(startBlock: number, endBlock: number): Promise<bigint> {
  let total = 0n;
  for (let blockNumber = startBlock + 1; blockNumber <= endBlock; blockNumber++) {
    const block = await ethers.provider.getBlock(blockNumber, true);
    const txs = Array.isArray(block?.transactions) ? block.transactions : [];
    for (const tx of txs) {
      const hash = typeof tx === "string" ? tx : tx.hash;
      const receipt = await ethers.provider.getTransactionReceipt(hash);
      if (receipt?.gasUsed) {
        total += receipt.gasUsed;
      }
    }
  }
  return total;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function parseAddresses(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function deploy<T>(
  factoryName: string,
  overrides: TxOverrides,
  ...args: unknown[]
): Promise<T & { getAddress(): Promise<string> }> {
  const factory = await ethers.getContractFactory(factoryName);
  const contract = await factory.deploy(...args, overrides);
  await contract.waitForDeployment();
  return contract as unknown as T & { getAddress(): Promise<string> };
}

function gwei(value: string): bigint {
  return ethers.parseUnits(value, "gwei");
}

const BASE_SEPOLIA_MAX_FEE_CAP_GWEI = "0.1";
const BASE_SEPOLIA_PRIORITY_CAP_GWEI = "0.02";

function assertBaseSepoliaFeeCaps(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint): void {
  if (network.name !== "base_sepolia") return;

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
  if (!maxFee && !maxPriority) {
    return {};
  }

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

async function clampTxOverrides(overrides: TxOverrides): Promise<TxOverrides> {
  const latest = await ethers.provider.getBlock("latest");
  const baseFee = latest?.baseFeePerGas ?? 0n;
  const priority = overrides.maxPriorityFeePerGas ?? gwei("0.1");
  const minMaxFee = baseFee + priority;
  const maxFee = overrides.maxFeePerGas ?? minMaxFee;

  return {
    maxPriorityFeePerGas: priority,
    maxFeePerGas: maxFee < minMaxFee ? minMaxFee : maxFee,
  };
}

async function getCreationCode(contractName: string): Promise<string> {
  const factory = await ethers.getContractFactory(contractName);
  return factory.bytecode;
}

async function isDeployedContract(address: string | undefined): Promise<boolean> {
  if (!address || address === ethers.ZeroAddress) return false;
  const code = await ethers.provider.getCode(address);
  return code !== "0x";
}

async function ensureFactoryInfra(deployerAddress: string, txOverrides: TxOverrides): Promise<FactoryInfra> {
  const existing = loadDeploymentFile(network.name);
  const existingAddresses = existing?.addresses ?? {};

  const reusable: Partial<FactoryInfra> = {
    governanceLayerFactory: existingAddresses.governanceLayerFactory,
    verificationLayerFactory: existingAddresses.verificationLayerFactory,
    economicLayerFactory: existingAddresses.economicLayerFactory,
    commerceLayerFactory: existingAddresses.commerceLayerFactory,
    coordinationLayerFactory: existingAddresses.coordinationLayerFactory,
  };

  if (!(await isDeployedContract(reusable.governanceLayerFactory))) {
    reusable.governanceLayerFactory = await (await deploy<any>("GovernanceLayerFactory", txOverrides)).getAddress();
  }
  if (!(await isDeployedContract(reusable.verificationLayerFactory))) {
    reusable.verificationLayerFactory = await (await deploy<any>("VerificationLayerFactory", txOverrides)).getAddress();
  }
  if (!(await isDeployedContract(reusable.economicLayerFactory))) {
    reusable.economicLayerFactory = await (await deploy<any>("EconomicLayerFactory", txOverrides)).getAddress();
  }
  if (!(await isDeployedContract(reusable.commerceLayerFactory))) {
    reusable.commerceLayerFactory = await (await deploy<any>("CommerceLayerFactory", txOverrides)).getAddress();
  }
  if (!(await isDeployedContract(reusable.coordinationLayerFactory))) {
    reusable.coordinationLayerFactory = await (await deploy<any>("CoordinationLayerFactory", txOverrides)).getAddress();
  }

  const resolved = reusable as FactoryInfra;
  const startBlock = existing?.startBlock ?? await ethers.provider.getBlockNumber();

  saveDeploymentFile({
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
    communityId: existing?.communityId,
    addresses: {
      ...existingAddresses,
      ...resolved,
    },
    configuration: existing?.configuration,
    startBlock,
  });

  return resolved;
}

async function main() {
  const startBlock = await ethers.provider.getBlockNumber();
  const txOverrides = await clampTxOverrides(getTxOverrides());
  const [deployer] = await ethers.getSigners();
  const base = defaultCommunityDeployConfig(deployer.address);

  const config: CommunityDeployConfig = {
    ...base,
    communityName: process.env.COMMUNITY_NAME || base.communityName,
    communityDescription: process.env.COMMUNITY_DESCRIPTION || base.communityDescription,
    communityMetadataURI: process.env.COMMUNITY_METADATA_URI || base.communityMetadataURI,
    founderAddress: process.env.FOUNDER_ADDRESS || base.founderAddress,
    treasuryVault: process.env.TREASURY_VAULT || base.treasuryVault,
    treasuryStableToken: process.env.TREASURY_STABLE_TOKEN || base.treasuryStableToken,
    supportedTokens: parseAddresses(process.env.SUPPORTED_TOKENS).length
      ? parseAddresses(process.env.SUPPORTED_TOKENS)
      : base.supportedTokens,
    initialMembershipTokens: BigInt(process.env.INITIAL_MEMBERSHIP_TOKENS || "0"),
    proposalThreshold: BigInt(process.env.PROPOSAL_THRESHOLD || "0"),
    votingDelay: Number(process.env.VOTING_DELAY || base.votingDelay),
    votingPeriod: Number(process.env.VOTING_PERIOD || base.votingPeriod),
    executionDelay: Number(process.env.EXECUTION_DELAY || base.executionDelay),
    verifierPanelSize: Number(process.env.VERIFIER_PANEL_SIZE || base.verifierPanelSize),
    verifierMin: Number(process.env.VERIFIER_MIN || base.verifierMin),
    maxPanelsPerEpoch: Number(process.env.MAX_PANELS_PER_EPOCH || base.maxPanelsPerEpoch),
    useVPTWeighting: parseBool(process.env.USE_VPT_WEIGHTING, base.useVPTWeighting),
    maxWeightPerVerifier: Number(process.env.MAX_WEIGHT_PER_VERIFIER || base.maxWeightPerVerifier),
    cooldownAfterFraud: Number(process.env.COOLDOWN_AFTER_FRAUD || base.cooldownAfterFraud),
    minTreasuryBps: Number(process.env.MIN_TREASURY_BPS || base.minTreasuryBps),
    minPositionsBps: Number(process.env.MIN_POSITIONS_BPS || base.minPositionsBps),
    spilloverTarget: Number(process.env.SPILLOVER_TARGET || base.spilloverTarget),
    spilloverSplitBpsTreasury: Number(
      process.env.SPILLOVER_SPLIT_BPS_TREASURY || base.spilloverSplitBpsTreasury,
    ),
    vptMetadataURI: process.env.VPT_METADATA_URI || base.vptMetadataURI,
  };

  const shared = await deploySharedInfraIfMissing();
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", shared.communityRegistry);

  const nextCommunityId = Number(await communityRegistry.nextCommunityId());

  const accessManager = await deploy<any>("ShiftAccessManager", txOverrides, deployer.address);
  const accessManagerAddress = await accessManager.getAddress();

  const factoryInfra = await ensureFactoryInfra(deployer.address, txOverrides);
  const governanceFactory = await ethers.getContractAt("GovernanceLayerFactory", factoryInfra.governanceLayerFactory);
  const verificationFactory = await ethers.getContractAt("VerificationLayerFactory", factoryInfra.verificationLayerFactory);
  const economicFactory = await ethers.getContractAt("EconomicLayerFactory", factoryInfra.economicLayerFactory);
  const commerceFactory = await ethers.getContractAt("CommerceLayerFactory", factoryInfra.commerceLayerFactory);
  const coordinationFactory = await ethers.getContractAt("CoordinationLayerFactory", factoryInfra.coordinationLayerFactory);

  const governanceCreationCodes = [
    await getCreationCode("MembershipTokenERC20Votes"),
    await getCreationCode("ShiftTimelockController"),
    await getCreationCode("ShiftGovernor"),
    await getCreationCode("CountingMultiChoice"),
  ];

  await (
    await governanceFactory.deployLayer(
      nextCommunityId,
      config.communityName,
      accessManagerAddress,
      config.executionDelay,
      deployer.address,
      governanceCreationCodes[0],
      governanceCreationCodes[1],
      governanceCreationCodes[2],
      governanceCreationCodes[3],
      txOverrides,
    )
  ).wait();
  const governance = await governanceFactory.lastDeploymentByCaller(deployer.address);

  const verificationCreationCodes = [
    await getCreationCode("VerifierPowerToken1155"),
    await getCreationCode("VerifierElection"),
    await getCreationCode("VerifierManager"),
    await getCreationCode("ValuableActionRegistry"),
    await getCreationCode("ValuableActionSBT"),
    await getCreationCode("Engagements"),
    await getCreationCode("PositionManager"),
    await getCreationCode("CredentialManager"),
  ];

  await (
    await verificationFactory.deployLayer(
      nextCommunityId,
      accessManagerAddress,
      shared.communityRegistry,
      governance.timelock,
      shared.paramController,
      governance.membershipToken,
      config.vptMetadataURI,
      verificationCreationCodes[0],
      verificationCreationCodes[1],
      verificationCreationCodes[2],
      verificationCreationCodes[3],
      verificationCreationCodes[4],
      verificationCreationCodes[5],
      verificationCreationCodes[6],
      verificationCreationCodes[7],
      txOverrides,
    )
  ).wait();
  const verification = await verificationFactory.lastDeploymentByCaller(deployer.address);

  const economicCreationCodes = [
    await getCreationCode("CohortRegistry"),
    await getCreationCode("InvestmentCohortManager"),
    await getCreationCode("RevenueRouter"),
    await getCreationCode("CommunityToken"),
    await getCreationCode("TreasuryAdapter"),
  ];

  await (
    await economicFactory.deployLayer(
      nextCommunityId,
      config.communityName,
      accessManagerAddress,
      shared.paramController,
      shared.communityRegistry,
      verification.valuableActionRegistry,
      verification.valuableActionSBT,
      config.treasuryStableToken,
      config.treasuryVault,
      economicCreationCodes[0],
      economicCreationCodes[1],
      economicCreationCodes[2],
      economicCreationCodes[3],
      economicCreationCodes[4],
      txOverrides,
    )
  ).wait();
  const economic = await economicFactory.lastDeploymentByCaller(deployer.address);

  const commerceCreationCodes = [
    await getCreationCode("CommerceDisputes"),
    await getCreationCode("Marketplace"),
    await getCreationCode("HousingManager"),
    await getCreationCode("ProjectFactory"),
  ];

  await (
    await commerceFactory.deployLayer(
      nextCommunityId,
      accessManagerAddress,
      config.treasuryStableToken,
      economic.revenueRouter,
      commerceCreationCodes[0],
      commerceCreationCodes[1],
      commerceCreationCodes[2],
      commerceCreationCodes[3],
      txOverrides,
    )
  ).wait();
  const commerce = await commerceFactory.lastDeploymentByCaller(deployer.address);

  const coordinationCreationCodes = [
    await getCreationCode("RequestHub"),
    await getCreationCode("DraftsManager"),
  ];

  await (
    await coordinationFactory.deployLayer(
      nextCommunityId,
      shared.communityRegistry,
      verification.valuableActionRegistry,
      governance.governor,
      accessManagerAddress,
      coordinationCreationCodes[0],
      coordinationCreationCodes[1],
      txOverrides,
    )
  ).wait();
  const coordination = await coordinationFactory.lastDeploymentByCaller(deployer.address);

  const moduleAddresses: CommunityModuleAddresses = {
    governor: governance.governor,
    timelock: governance.timelock,
    requestHub: coordination.requestHub,
    draftsManager: coordination.draftsManager,
    engagementsManager: verification.engagements,
    valuableActionRegistry: verification.valuableActionRegistry,
    verifierPowerToken: verification.verifierPowerToken,
    verifierElection: verification.verifierElection,
    verifierManager: verification.verifierManager,
    valuableActionSBT: verification.valuableActionSBT,
    treasuryVault: config.treasuryVault,
    treasuryAdapter: economic.treasuryAdapter,
    communityToken: economic.communityToken,
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
    membershipToken: governance.membershipToken,
    timelock: governance.timelock,
    governor: governance.governor,
    countingMultiChoice: governance.countingMultiChoice,
    verifierPowerToken: verification.verifierPowerToken,
    verifierElection: verification.verifierElection,
    verifierManager: verification.verifierManager,
    valuableActionRegistry: verification.valuableActionRegistry,
    valuableActionSBT: verification.valuableActionSBT,
    engagements: verification.engagements,
    positionManager: verification.positionManager,
    credentialManager: verification.credentialManager,
    cohortRegistry: economic.cohortRegistry,
    investmentCohortManager: economic.investmentCohortManager,
    revenueRouter: economic.revenueRouter,
    communityToken: economic.communityToken,
    treasuryAdapter: economic.treasuryAdapter,
    requestHub: coordination.requestHub,
    draftsManager: coordination.draftsManager,
    commerceDisputes: commerce.commerceDisputes,
    marketplace: commerce.marketplace,
    housingManager: commerce.housingManager,
    projectFactory: commerce.projectFactory,
  };

  const currentBlock = await ethers.provider.getBlockNumber();
  const deploymentAddresses = {
    ...addresses,
    ...factoryInfra,
  };

  saveDeploymentFile({
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    communityId,
    addresses: deploymentAddresses,
    configuration: {
      communityName: config.communityName,
      votingDelay: config.votingDelay,
      votingPeriod: config.votingPeriod,
      executionDelay: config.executionDelay,
      minTreasuryBps: config.minTreasuryBps,
      minPositionsBps: config.minPositionsBps,
      supportedTokens: config.supportedTokens,
      deploymentMode: "layer-factories",
    },
    startBlock: currentBlock,
  });

  console.log(`✅ Factory deploy stack completed (communityId=${communityId})`);
  const totalGasUsed = await sumGasUsedBetween(startBlock, currentBlock);
  console.log(`⛽ Total gas used (script scope): ${totalGasUsed.toString()}`);
}

main().catch((error) => {
  console.error("❌ factory-deploy failed", error);
  process.exitCode = 1;
});
