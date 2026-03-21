import hre from "hardhat";
import {
  CommunityDeployConfig,
  defaultCommunityDeployConfig,
  deployCommunityStack,
  deploySharedInfraIfMissing,
} from "./community-deploy-lib";

const { ethers } = hre;

type GasMap = Record<string, bigint>;

type TxOverrides = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

function gwei(value: string): bigint {
  return ethers.parseUnits(value, "gwei");
}

function getTxOverrides(): TxOverrides {
  return {
    maxFeePerGas: gwei("5"),
    maxPriorityFeePerGas: gwei("1"),
  };
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

function buildConfig(founder: string): CommunityDeployConfig {
  const base = defaultCommunityDeployConfig(founder);
  return {
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
}

function addGas(map: GasMap, key: string, value: bigint): void {
  map[key] = (map[key] || 0n) + value;
}

async function sumGasBetween(startBlock: number, endBlock: number): Promise<bigint> {
  let total = 0n;
  for (let blockNumber = startBlock + 1; blockNumber <= endBlock; blockNumber++) {
    const block = await ethers.provider.getBlock(blockNumber, true);
    const txs = Array.isArray(block?.transactions) ? block.transactions : [];
    for (const tx of txs) {
      const hash = typeof tx === "string" ? tx : tx.hash;
      const receipt = await ethers.provider.getTransactionReceipt(hash);
      if (receipt?.gasUsed) total += receipt.gasUsed;
    }
  }
  return total;
}

async function getCreationCode(contractName: string): Promise<string> {
  const factory = await ethers.getContractFactory(contractName);
  return factory.bytecode;
}

async function deployContract<T>(
  contractName: string,
  overrides: TxOverrides,
  ...args: unknown[]
): Promise<T & { getAddress(): Promise<string>; deploymentTransaction(): any }> {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...args, overrides);
  await contract.waitForDeployment();
  return contract as unknown as T & { getAddress(): Promise<string>; deploymentTransaction(): any };
}

function printGasMap(title: string, gasMap: GasMap): bigint {
  const keys = Object.keys(gasMap).sort((a, b) => {
    const av = gasMap[a];
    const bv = gasMap[b];
    if (av === bv) return a.localeCompare(b);
    return av > bv ? -1 : 1;
  });

  console.log(`\n${title}`);
  let total = 0n;
  for (const key of keys) {
    total += gasMap[key];
    console.log(`- ${key}: ${gasMap[key].toString()}`);
  }
  console.log(`- TOTAL_CONTRACT_DEPLOY_GAS: ${total.toString()}`);
  return total;
}

async function benchmarkDirect(config: CommunityDeployConfig): Promise<{ totalStackGas: bigint; deployGasByContract: GasMap }> {
  const startBlock = await ethers.provider.getBlockNumber();
  const result = await deployCommunityStack(config);
  const endBlock = await ethers.provider.getBlockNumber();

  const totalStackGas = await sumGasBetween(startBlock, endBlock);

  const byAddress = new Map<string, string>();
  for (const [name, addr] of Object.entries(result.addresses)) {
    byAddress.set(addr.toLowerCase(), name);
  }

  const deployGasByContract: GasMap = {};

  for (let block = startBlock + 1; block <= endBlock; block++) {
    const blockData = await ethers.provider.getBlock(block, true);
    const txs = Array.isArray(blockData?.transactions) ? blockData.transactions : [];
    for (const tx of txs) {
      const hash = typeof tx === "string" ? tx : tx.hash;
      const receipt = await ethers.provider.getTransactionReceipt(hash);
      if (!receipt?.contractAddress || !receipt.gasUsed) continue;
      const contractName = byAddress.get(receipt.contractAddress.toLowerCase());
      if (contractName) {
        addGas(deployGasByContract, contractName, receipt.gasUsed);
      }
    }
  }

  return { totalStackGas, deployGasByContract };
}

async function benchmarkFactory(config: CommunityDeployConfig): Promise<{ totalStackGas: bigint; deployGasByContract: GasMap }> {
  const txOverrides = getTxOverrides();
  const [deployer] = await ethers.getSigners();

  const shared = await deploySharedInfraIfMissing();
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", shared.communityRegistry);
  const paramController = await ethers.getContractAt("ParamController", shared.paramController);

  // Shared factory infra: deployed once and explicitly excluded from community stack gas measurement.
  const governanceLayerFactory = await deployContract<any>("GovernanceLayerFactory", txOverrides);
  const verificationLayerFactory = await deployContract<any>("VerificationLayerFactory", txOverrides);
  const economicLayerFactory = await deployContract<any>("EconomicLayerFactory", txOverrides);
  const commerceLayerFactory = await deployContract<any>("CommerceLayerFactory", txOverrides);
  const coordinationLayerFactory = await deployContract<any>("CoordinationLayerFactory", txOverrides);

  const governanceFactory = await ethers.getContractAt("GovernanceLayerFactory", await governanceLayerFactory.getAddress());
  const verificationFactory = await ethers.getContractAt("VerificationLayerFactory", await verificationLayerFactory.getAddress());
  const economicFactory = await ethers.getContractAt("EconomicLayerFactory", await economicLayerFactory.getAddress());
  const commerceFactory = await ethers.getContractAt("CommerceLayerFactory", await commerceLayerFactory.getAddress());
  const coordinationFactory = await ethers.getContractAt("CoordinationLayerFactory", await coordinationLayerFactory.getAddress());

  const startBlock = await ethers.provider.getBlockNumber();

  const nextCommunityId = Number(await communityRegistry.nextCommunityId());

  const accessManager = await deployContract<any>("ShiftAccessManager", txOverrides, deployer.address);
  const accessManagerAddress = await accessManager.getAddress();

  const deployGasByContract: GasMap = {};
  const accessReceipt = await accessManager.deploymentTransaction().wait();
  addGas(deployGasByContract, "accessManager", accessReceipt.gasUsed);

  const governanceCreationCodes = [
    await getCreationCode("MembershipTokenERC20Votes"),
    await getCreationCode("ShiftTimelockController"),
    await getCreationCode("ShiftGovernor"),
    await getCreationCode("CountingMultiChoice"),
  ];

  const governanceTx = await governanceFactory.deployLayer(
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
  );
  const governanceReceipt = await governanceTx.wait();
  addGas(deployGasByContract, "governanceLayer.deployLayer", governanceReceipt.gasUsed);
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

  const verificationTx = await verificationFactory.deployLayer(
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
  );
  const verificationReceipt = await verificationTx.wait();
  addGas(deployGasByContract, "verificationLayer.deployLayer", verificationReceipt.gasUsed);
  const verification = await verificationFactory.lastDeploymentByCaller(deployer.address);

  const economicCreationCodes = [
    await getCreationCode("CohortRegistry"),
    await getCreationCode("InvestmentCohortManager"),
    await getCreationCode("RevenueRouter"),
    await getCreationCode("CommunityToken"),
    await getCreationCode("TreasuryAdapter"),
  ];

  const economicTx = await economicFactory.deployLayer(
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
  );
  const economicReceipt = await economicTx.wait();
  addGas(deployGasByContract, "economicLayer.deployLayer", economicReceipt.gasUsed);
  const economic = await economicFactory.lastDeploymentByCaller(deployer.address);

  const commerceCreationCodes = [
    await getCreationCode("CommerceDisputes"),
    await getCreationCode("Marketplace"),
    await getCreationCode("HousingManager"),
    await getCreationCode("ProjectFactory"),
  ];

  const commerceTx = await commerceFactory.deployLayer(
    nextCommunityId,
    accessManagerAddress,
    config.treasuryStableToken,
    economic.revenueRouter,
    commerceCreationCodes[0],
    commerceCreationCodes[1],
    commerceCreationCodes[2],
    commerceCreationCodes[3],
    txOverrides,
  );
  const commerceReceipt = await commerceTx.wait();
  addGas(deployGasByContract, "commerceLayer.deployLayer", commerceReceipt.gasUsed);
  const commerce = await commerceFactory.lastDeploymentByCaller(deployer.address);

  const coordinationCreationCodes = [
    await getCreationCode("RequestHub"),
    await getCreationCode("DraftsManager"),
  ];

  const coordinationTx = await coordinationFactory.deployLayer(
    nextCommunityId,
    shared.communityRegistry,
    verification.valuableActionRegistry,
    governance.governor,
    accessManagerAddress,
    coordinationCreationCodes[0],
    coordinationCreationCodes[1],
    txOverrides,
  );
  const coordinationReceipt = await coordinationTx.wait();
  addGas(deployGasByContract, "coordinationLayer.deployLayer", coordinationReceipt.gasUsed);
  const coordination = await coordinationFactory.lastDeploymentByCaller(deployer.address);

  const registerTx = await communityRegistry.registerCommunity(
    config.communityName,
    config.communityDescription,
    config.communityMetadataURI,
    0,
    txOverrides,
  );
  const registerReceipt = await registerTx.wait();
  addGas(deployGasByContract, "registerCommunity", registerReceipt.gasUsed);

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

  await (await paramController.setVerifierParams(
    communityId,
    config.verifierPanelSize,
    config.verifierMin,
    config.maxPanelsPerEpoch,
    config.useVPTWeighting,
    config.maxWeightPerVerifier,
    config.cooldownAfterFraud,
    txOverrides,
  )).wait().then((r: any) => addGas(deployGasByContract, "setVerifierParams", r.gasUsed));
  await (await paramController.setGovernanceParams(
    communityId,
    config.votingDelay,
    config.votingPeriod,
    config.executionDelay,
    txOverrides,
  )).wait().then((r: any) => addGas(deployGasByContract, "setGovernanceParams", r.gasUsed));
  await (await paramController.setEligibilityParams(communityId, 0, 0, config.proposalThreshold, txOverrides))
    .wait().then((r: any) => addGas(deployGasByContract, "setEligibilityParams", r.gasUsed));
  await (await paramController.setRevenuePolicy(
    communityId,
    config.minTreasuryBps,
    config.minPositionsBps,
    config.spilloverTarget,
    config.spilloverSplitBpsTreasury,
    txOverrides,
  )).wait().then((r: any) => addGas(deployGasByContract, "setRevenuePolicy", r.gasUsed));

  await (await communityRegistry.setModuleAddresses(communityId, {
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
  }, txOverrides)).wait().then((r: any) => addGas(deployGasByContract, "setModuleAddresses", r.gasUsed));

  const endBlock = await ethers.provider.getBlockNumber();
  const totalStackGas = await sumGasBetween(startBlock, endBlock);

  return { totalStackGas, deployGasByContract };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const config = buildConfig(deployer.address);

  // Deploy shared infra once to remove its cost from both comparisons.
  await deploySharedInfraIfMissing();

  const direct = await benchmarkDirect(config);
  const factory = await benchmarkFactory(config);

  const directSharedInfraGas = (direct.deployGasByContract.paramController || 0n)
    + (direct.deployGasByContract.communityRegistry || 0n);
  const directAdjusted = direct.totalStackGas - directSharedInfraGas;

  console.log("\n=== COMMUNITY STACK GAS BENCHMARK (shared infra excluded) ===");
  console.log(`DIRECT_STACK_TOTAL_GAS_RAW: ${direct.totalStackGas.toString()}`);
  console.log(`DIRECT_SHARED_INFRA_GAS_EXCLUDED: ${directSharedInfraGas.toString()}`);
  console.log(`DIRECT_STACK_TOTAL_GAS_ADJUSTED: ${directAdjusted.toString()}`);
  console.log(`FACTORY_STACK_TOTAL_GAS: ${factory.totalStackGas.toString()}`);
  const delta = factory.totalStackGas - directAdjusted;
  console.log(`DELTA_FACTORY_MINUS_DIRECT: ${delta.toString()}`);

  const directDeployTotal = printGasMap("DIRECT per-contract deployment gas", direct.deployGasByContract);
  const factoryDeployTotal = printGasMap("FACTORY per-contract deployment gas", factory.deployGasByContract);
  console.log(`\nDELTA_DEPLOY_ONLY_FACTORY_MINUS_DIRECT: ${(factoryDeployTotal - directDeployTotal).toString()}`);
}

main().catch((error) => {
  console.error("❌ benchmark-community-gas failed", error);
  process.exitCode = 1;
});
