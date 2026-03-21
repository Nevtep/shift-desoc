import type { Abi, PublicClient } from "viem";
import { decodeEventLog, encodeDeployData } from "viem";

import type { StepExecutor, StepExecutionResult, WriteContractAsync } from "./default-step-executor";
import { createDefaultUserSignedStepExecutor } from "./default-step-executor";
import type {
  CommunityDeploymentConfig,
} from "./config";
import type {
  DeploymentRunAddresses,
  DeploymentWizardSession,
  PreflightAssessment,
} from "./types";

const STRICT_STAGING_CHAIN_ID = 84532;

const FACTORY_ENV_KEYS = {
  governance: "NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY",
  verification: "NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY",
  economic: "NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY",
  commerce: "NEXT_PUBLIC_COMMERCE_LAYER_FACTORY",
  coordination: "NEXT_PUBLIC_COORDINATION_LAYER_FACTORY",
  bootstrapCoordinator: "NEXT_PUBLIC_BOOTSTRAP_COORDINATOR",
} as const;

type FactoryAddresses = {
  governance: `0x${string}`;
  verification: `0x${string}`;
  economic: `0x${string}`;
  commerce: `0x${string}`;
  coordination: `0x${string}`;
};

type DeployContext = {
  config: CommunityDeploymentConfig;
  chainId: number;
  preflight: PreflightAssessment;
  onTxConfirmed?: (txHash: `0x${string}`) => void;
  onDeploymentAddresses?: (addresses: Partial<DeploymentRunAddresses>) => void;
};

type SharedInfra = {
  communityRegistry: `0x${string}`;
  paramController: `0x${string}`;
};

const COMMUNITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "nextCommunityId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "registerCommunity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "parentCommunityId", type: "uint256" },
    ],
    outputs: [{ name: "communityId", type: "uint256" }],
  },
  {
    type: "event",
    name: "CommunityRegistered",
    inputs: [
      { indexed: true, name: "communityId", type: "uint256" },
      { indexed: false, name: "name", type: "string" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "parentCommunityId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "setModuleAddresses",
    stateMutability: "nonpayable",
    inputs: [
      { name: "communityId", type: "uint256" },
      {
        name: "modules",
        type: "tuple",
        components: [
          { name: "governor", type: "address" },
          { name: "timelock", type: "address" },
          { name: "requestHub", type: "address" },
          { name: "draftsManager", type: "address" },
          { name: "engagementsManager", type: "address" },
          { name: "valuableActionRegistry", type: "address" },
          { name: "verifierPowerToken", type: "address" },
          { name: "verifierElection", type: "address" },
          { name: "verifierManager", type: "address" },
          { name: "valuableActionSBT", type: "address" },
          { name: "treasuryVault", type: "address" },
          { name: "treasuryAdapter", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "paramController", type: "address" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "bootstrapCommunity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "parentCommunityId", type: "uint256" },
      {
        name: "bootstrapParams",
        type: "tuple",
        components: [
          { name: "verifierPanelSize", type: "uint256" },
          { name: "verifierMin", type: "uint256" },
          { name: "maxPanelsPerEpoch", type: "uint256" },
          { name: "useVPTWeighting", type: "bool" },
          { name: "maxWeightPerVerifier", type: "uint256" },
          { name: "cooldownAfterFraud", type: "uint256" },
          { name: "debateWindow", type: "uint256" },
          { name: "voteWindow", type: "uint256" },
          { name: "executionDelay", type: "uint256" },
          { name: "minSeniority", type: "uint256" },
          { name: "minSBTs", type: "uint256" },
          { name: "proposalThreshold", type: "uint256" },
          { name: "minTreasuryBps", type: "uint16" },
          { name: "minPositionsBps", type: "uint16" },
          { name: "spilloverTarget", type: "uint8" },
          { name: "spilloverSplitBpsToTreasury", type: "uint16" },
        ],
      },
      {
        name: "modules",
        type: "tuple",
        components: [
          { name: "governor", type: "address" },
          { name: "timelock", type: "address" },
          { name: "requestHub", type: "address" },
          { name: "draftsManager", type: "address" },
          { name: "engagementsManager", type: "address" },
          { name: "valuableActionRegistry", type: "address" },
          { name: "verifierPowerToken", type: "address" },
          { name: "verifierElection", type: "address" },
          { name: "verifierManager", type: "address" },
          { name: "valuableActionSBT", type: "address" },
          { name: "treasuryVault", type: "address" },
          { name: "treasuryAdapter", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "paramController", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "communityId", type: "uint256" }],
  },
] as const satisfies Abi;

const PARAM_CONTROLLER_ABI = [
  {
    type: "function",
    name: "setVerifierParams",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setGovernanceParams",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setEligibilityParams",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setRevenuePolicy",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

const SHIFT_ACCESS_MANAGER_ABI = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "initialAdmin", type: "address" }],
  },
  {
    type: "function",
    name: "ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [{ type: "uint64" }, { type: "address" }],
    outputs: [{ type: "bool" }, { type: "uint32" }],
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint64" }, { type: "address" }, { type: "uint32" }],
    outputs: [],
  }
] as const satisfies Abi;

const BASE_DEPLOY_FALLBACK_GAS = 900000n;
const DEPLOY_LAYER_FALLBACK_GAS = 6000000n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function requireAddressArg(value: unknown, label: string): `0x${string}` {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: expected 20-byte 0x address, received ${String(value)}.`);
  }
  if (value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`Invalid ${label}: received zero address.`);
  }
  return value as `0x${string}`;
}

function pickAddress(raw: unknown, key: string, index: number, label: string): `0x${string}` {
  const value = (raw as Record<string, unknown>)?.[key] ?? (raw as unknown[] | undefined)?.[index];
  return requireAddressArg(value, label);
}

function normalizeGovernanceDeployment(raw: unknown): {
  membershipToken: `0x${string}`;
  timelock: `0x${string}`;
  governor: `0x${string}`;
  countingMultiChoice: `0x${string}`;
} {
  return {
    membershipToken: pickAddress(raw, "membershipToken", 0, "governance.membershipToken"),
    timelock: pickAddress(raw, "timelock", 1, "governance.timelock"),
    governor: pickAddress(raw, "governor", 2, "governance.governor"),
    countingMultiChoice: pickAddress(raw, "countingMultiChoice", 3, "governance.countingMultiChoice"),
  };
}

function normalizeVerificationDeployment(raw: unknown): {
  verifierPowerToken: `0x${string}`;
  verifierElection: `0x${string}`;
  verifierManager: `0x${string}`;
  valuableActionRegistry: `0x${string}`;
  valuableActionSBT: `0x${string}`;
  engagements: `0x${string}`;
  positionManager: `0x${string}`;
  credentialManager: `0x${string}`;
} {
  return {
    verifierPowerToken: pickAddress(raw, "verifierPowerToken", 0, "verification.verifierPowerToken"),
    verifierElection: pickAddress(raw, "verifierElection", 1, "verification.verifierElection"),
    verifierManager: pickAddress(raw, "verifierManager", 2, "verification.verifierManager"),
    valuableActionRegistry: pickAddress(raw, "valuableActionRegistry", 3, "verification.valuableActionRegistry"),
    valuableActionSBT: pickAddress(raw, "valuableActionSBT", 4, "verification.valuableActionSBT"),
    engagements: pickAddress(raw, "engagements", 5, "verification.engagements"),
    positionManager: pickAddress(raw, "positionManager", 6, "verification.positionManager"),
    credentialManager: pickAddress(raw, "credentialManager", 7, "verification.credentialManager"),
  };
}

function normalizeEconomicDeployment(raw: unknown): {
  cohortRegistry: `0x${string}`;
  investmentCohortManager: `0x${string}`;
  revenueRouter: `0x${string}`;
  communityToken: `0x${string}`;
  treasuryAdapter: `0x${string}`;
} {
  return {
    cohortRegistry: pickAddress(raw, "cohortRegistry", 0, "economic.cohortRegistry"),
    investmentCohortManager: pickAddress(raw, "investmentCohortManager", 1, "economic.investmentCohortManager"),
    revenueRouter: pickAddress(raw, "revenueRouter", 2, "economic.revenueRouter"),
    communityToken: pickAddress(raw, "communityToken", 3, "economic.communityToken"),
    treasuryAdapter: pickAddress(raw, "treasuryAdapter", 4, "economic.treasuryAdapter"),
  };
}

function normalizeCommerceDeployment(raw: unknown): {
  commerceDisputes: `0x${string}`;
  marketplace: `0x${string}`;
  housingManager: `0x${string}`;
  projectFactory: `0x${string}`;
} {
  return {
    commerceDisputes: pickAddress(raw, "commerceDisputes", 0, "commerce.commerceDisputes"),
    marketplace: pickAddress(raw, "marketplace", 1, "commerce.marketplace"),
    housingManager: pickAddress(raw, "housingManager", 2, "commerce.housingManager"),
    projectFactory: pickAddress(raw, "projectFactory", 3, "commerce.projectFactory"),
  };
}

function normalizeCoordinationDeployment(raw: unknown): {
  requestHub: `0x${string}`;
  draftsManager: `0x${string}`;
} {
  return {
    requestHub: pickAddress(raw, "requestHub", 0, "coordination.requestHub"),
    draftsManager: pickAddress(raw, "draftsManager", 1, "coordination.draftsManager"),
  };
}

function decodeCommerceDeploymentFromReceipt(
  abi: Abi,
  receipt: { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
): {
  commerceDisputes: `0x${string}`;
  marketplace: `0x${string}`;
  housingManager: `0x${string}`;
  projectFactory: `0x${string}`;
} | null {
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics as any,
      });
      if (decoded.eventName !== "CommerceLayerDeployed") continue;
      const args = decoded.args as {
        commerceDisputes?: unknown;
        marketplace?: unknown;
        housingManager?: unknown;
        projectFactory?: unknown;
      };
      return {
        commerceDisputes: requireAddressArg(args.commerceDisputes, "commerce.commerceDisputes"),
        marketplace: requireAddressArg(args.marketplace, "commerce.marketplace"),
        housingManager: requireAddressArg(args.housingManager, "commerce.housingManager"),
        projectFactory: requireAddressArg(args.projectFactory, "commerce.projectFactory"),
      };
    } catch {
      // Ignore unrelated logs.
    }
  }
  return null;
}

function decodeCoordinationDeploymentFromReceipt(
  abi: Abi,
  receipt: { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
): {
  requestHub: `0x${string}`;
  draftsManager: `0x${string}`;
} | null {
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics as any,
      });
      if (decoded.eventName !== "CoordinationLayerDeployed") continue;
      const args = decoded.args as {
        requestHub?: unknown;
        draftsManager?: unknown;
      };
      return {
        requestHub: requireAddressArg(args.requestHub, "coordination.requestHub"),
        draftsManager: requireAddressArg(args.draftsManager, "coordination.draftsManager"),
      };
    } catch {
      // Ignore unrelated logs.
    }
  }
  return null;
}

function hasAddresses(
  source: Partial<DeploymentRunAddresses>,
  keys: Array<keyof DeploymentRunAddresses>,
): boolean {
  return keys.every((key) => {
    const value = source[key];
    return typeof value === "string" && value.toLowerCase() !== ZERO_ADDRESS;
  });
}

function assertStrictStagingMode(chainId: number): void {
  if (chainId !== STRICT_STAGING_CHAIN_ID) {
    throw new Error(
      `Strict staging mode only supports Base Sepolia (${STRICT_STAGING_CHAIN_ID}). Received chainId=${chainId}.`,
    );
  }
}

function requiredAddress(value: string | undefined, label: string): `0x${string}` {
  if (!value) {
    throw new Error(`Missing ${label}. Set the corresponding NEXT_PUBLIC_* env var for wizard factory deploy.`);
  }
  return value as `0x${string}`;
}

function resolveFactoryAddresses(): FactoryAddresses {
  return {
    governance: requiredAddress(process.env[FACTORY_ENV_KEYS.governance], FACTORY_ENV_KEYS.governance),
    verification: requiredAddress(process.env[FACTORY_ENV_KEYS.verification], FACTORY_ENV_KEYS.verification),
    economic: requiredAddress(process.env[FACTORY_ENV_KEYS.economic], FACTORY_ENV_KEYS.economic),
    commerce: requiredAddress(process.env[FACTORY_ENV_KEYS.commerce], FACTORY_ENV_KEYS.commerce),
    coordination: requiredAddress(process.env[FACTORY_ENV_KEYS.coordination], FACTORY_ENV_KEYS.coordination),
  };
}

function resolveFactoryAddressesFromPreflight(preflight: PreflightAssessment): FactoryAddresses {
  const governance = preflight.sharedInfra.governanceLayerFactory.address;
  const verification = preflight.sharedInfra.verificationLayerFactory.address;
  const economic = preflight.sharedInfra.economicLayerFactory.address;
  const commerce = preflight.sharedInfra.commerceLayerFactory.address;
  const coordination = preflight.sharedInfra.coordinationLayerFactory.address;

  if (!governance || !verification || !economic || !commerce || !coordination) {
    return resolveFactoryAddresses();
  }

  return {
    governance: governance as `0x${string}`,
    verification: verification as `0x${string}`,
    economic: economic as `0x${string}`,
    commerce: commerce as `0x${string}`,
    coordination: coordination as `0x${string}`,
  };
}

function resolveBootstrapCoordinatorAddress(): `0x${string}` | undefined {
  const value = process.env[FACTORY_ENV_KEYS.bootstrapCoordinator];
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return undefined;
  }
  return value as `0x${string}`;
}

function resolveSharedInfra(preflight: PreflightAssessment): SharedInfra {
  const communityRegistry = preflight.sharedInfra.communityRegistry.address;
  const paramController = preflight.sharedInfra.paramController.address;

  if (!communityRegistry || !paramController) {
    throw new Error("Preflight did not provide required shared infra addresses for factory deploy.");
  }

  return {
    communityRegistry: communityRegistry as `0x${string}`,
    paramController: paramController as `0x${string}`,
  };
}

function parseAddresses(csv: string): `0x${string}`[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as `0x${string}`[];
}

async function resolveGasLimit(
  publicClient: PublicClient,
  args: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  },
  account?: `0x${string}`,
): Promise<bigint> {
  try {
    const estimated = (await publicClient.estimateContractGas({
      ...args,
      account,
    } as never)) as bigint;
    return (estimated * 12n) / 10n;
  } catch {
    if (args.functionName === "deployLayer") {
      return DEPLOY_LAYER_FALLBACK_GAS;
    }
    return BASE_DEPLOY_FALLBACK_GAS;
  }
}

async function writeAndConfirm(
  writeContractAsync: WriteContractAsync,
  publicClient: PublicClient,
  txHashes: `0x${string}`[],
  args: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  },
  account?: `0x${string}`,
  nonce?: bigint,
  onTxConfirmed?: (txHash: `0x${string}`) => void,
) {
  const gas = await resolveGasLimit(publicClient, args, account);
  const hash = await writeContractAsync({ ...args, gas, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 300_000,
    retryCount: 24,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted for ${args.functionName} (${hash}).`);
  }
  txHashes.push(hash);
  onTxConfirmed?.(hash);
  return { hash, receipt };
}

type DeployContractAsync = (args: {
  abi: Abi;
  bytecode: `0x${string}`;
  args?: readonly unknown[];
  gas?: bigint;
  nonce?: bigint;
}) => Promise<`0x${string}`>;

const BASE_CREATE_FALLBACK_GAS = 1_500_000n;

async function resolveCreateGasLimit(
  publicClient: PublicClient,
  args: {
    abi: Abi;
    bytecode: `0x${string}`;
    args?: readonly unknown[];
  },
  account?: `0x${string}`,
): Promise<bigint> {
  try {
    const data = encodeDeployData({
      abi: args.abi,
      bytecode: args.bytecode,
      args: args.args,
    });
    const estimated = await publicClient.estimateGas({ account, data });
    return (estimated * 12n) / 10n;
  } catch {
    return BASE_CREATE_FALLBACK_GAS;
  }
}

async function deployAndConfirm(
  deployContractAsync: DeployContractAsync,
  publicClient: PublicClient,
  txHashes: `0x${string}`[],
  args: {
    abi: Abi;
    bytecode: `0x${string}`;
    args?: readonly unknown[];
  },
  account?: `0x${string}`,
  nonce?: bigint,
  onTxConfirmed?: (txHash: `0x${string}`) => void,
): Promise<`0x${string}`> {
  const gas = await resolveCreateGasLimit(publicClient, args, account);
  const hash = await deployContractAsync({ ...args, gas, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 300_000,
    retryCount: 24,
  });
  if (receipt.status !== "success") {
    throw new Error(`Contract deployment reverted (${hash}).`);
  }
  if (!receipt.contractAddress) {
    throw new Error(`Deployment receipt missing contractAddress (${hash}).`);
  }
  txHashes.push(hash);
  onTxConfirmed?.(hash);
  return receipt.contractAddress;
}

let factoryArtifactsPromise: Promise<{
  governanceAbi: Abi;
  verificationAbi: Abi;
  economicAbi: Abi;
  commerceAbi: Abi;
  coordinationAbi: Abi;
  creationCodes: {
    membershipToken: `0x${string}`;
    timelock: `0x${string}`;
    governor: `0x${string}`;
    countingMultiChoice: `0x${string}`;
    verifierPowerToken: `0x${string}`;
    verifierElection: `0x${string}`;
    verifierManager: `0x${string}`;
    valuableActionRegistry: `0x${string}`;
    valuableActionSBT: `0x${string}`;
    engagements: `0x${string}`;
    positionManager: `0x${string}`;
    credentialManager: `0x${string}`;
    cohortRegistry: `0x${string}`;
    investmentCohortManager: `0x${string}`;
    revenueRouter: `0x${string}`;
    communityToken: `0x${string}`;
    treasuryAdapter: `0x${string}`;
    commerceDisputes: `0x${string}`;
    marketplace: `0x${string}`;
    housingManager: `0x${string}`;
    projectFactory: `0x${string}`;
    requestHub: `0x${string}`;
    draftsManager: `0x${string}`;
    shiftAccessManager: `0x${string}`;
  };
}> | null = null;

async function loadFactoryArtifacts() {
  if (!factoryArtifactsPromise) {
    factoryArtifactsPromise = (async () => {
      const [
        governanceFactory,
        verificationFactory,
        economicFactory,
        commerceFactory,
        coordinationFactory,
        membershipToken,
        timelock,
        governor,
        countingMultiChoice,
        verifierPowerToken,
        verifierElection,
        verifierManager,
        valuableActionRegistry,
        valuableActionSBT,
        engagements,
        positionManager,
        credentialManager,
        cohortRegistry,
        investmentCohortManager,
        revenueRouter,
        communityToken,
        treasuryAdapter,
        commerceDisputes,
        marketplace,
        housingManager,
        projectFactory,
        requestHub,
        draftsManager,
        shiftAccessManager,
      ] = await Promise.all([
        import("../../../../artifacts/contracts/modules/factories/GovernanceLayerFactory.sol/GovernanceLayerFactory.json"),
        import("../../../../artifacts/contracts/modules/factories/VerificationLayerFactory.sol/VerificationLayerFactory.json"),
        import("../../../../artifacts/contracts/modules/factories/EconomicLayerFactory.sol/EconomicLayerFactory.json"),
        import("../../../../artifacts/contracts/modules/factories/CommerceLayerFactory.sol/CommerceLayerFactory.json"),
        import("../../../../artifacts/contracts/modules/factories/CoordinationLayerFactory.sol/CoordinationLayerFactory.json"),
        import("../../../../artifacts/contracts/tokens/MembershipTokenERC20Votes.sol/MembershipTokenERC20Votes.json"),
        import("../../../../artifacts/contracts/core/ShiftTimelockController.sol/ShiftTimelockController.json"),
        import("../../../../artifacts/contracts/core/ShiftGovernor.sol/ShiftGovernor.json"),
        import("../../../../artifacts/contracts/core/CountingMultiChoice.sol/CountingMultiChoice.json"),
        import("../../../../artifacts/contracts/tokens/VerifierPowerToken1155.sol/VerifierPowerToken1155.json"),
        import("../../../../artifacts/contracts/modules/VerifierElection.sol/VerifierElection.json"),
        import("../../../../artifacts/contracts/modules/VerifierManager.sol/VerifierManager.json"),
        import("../../../../artifacts/contracts/modules/ValuableActionRegistry.sol/ValuableActionRegistry.json"),
        import("../../../../artifacts/contracts/modules/ValuableActionSBT.sol/ValuableActionSBT.json"),
        import("../../../../artifacts/contracts/modules/Engagements.sol/Engagements.json"),
        import("../../../../artifacts/contracts/modules/PositionManager.sol/PositionManager.json"),
        import("../../../../artifacts/contracts/modules/CredentialManager.sol/CredentialManager.json"),
        import("../../../../artifacts/contracts/modules/CohortRegistry.sol/CohortRegistry.json"),
        import("../../../../artifacts/contracts/modules/InvestmentCohortManager.sol/InvestmentCohortManager.json"),
        import("../../../../artifacts/contracts/modules/RevenueRouter.sol/RevenueRouter.json"),
        import("../../../../artifacts/contracts/tokens/CommunityToken.sol/CommunityToken.json"),
        import("../../../../artifacts/contracts/modules/TreasuryAdapter.sol/TreasuryAdapter.json"),
        import("../../../../artifacts/contracts/modules/CommerceDisputes.sol/CommerceDisputes.json"),
        import("../../../../artifacts/contracts/modules/Marketplace.sol/Marketplace.json"),
        import("../../../../artifacts/contracts/modules/HousingManager.sol/HousingManager.json"),
        import("../../../../artifacts/contracts/modules/ProjectFactory.sol/ProjectFactory.json"),
        import("../../../../artifacts/contracts/modules/RequestHub.sol/RequestHub.json"),
        import("../../../../artifacts/contracts/modules/DraftsManager.sol/DraftsManager.json"),
        import("../../../../artifacts/contracts/core/ShiftAccessManager.sol/ShiftAccessManager.json"),
      ]);

      return {
        governanceAbi: governanceFactory.abi as Abi,
        verificationAbi: verificationFactory.abi as Abi,
        economicAbi: economicFactory.abi as Abi,
        commerceAbi: commerceFactory.abi as Abi,
        coordinationAbi: coordinationFactory.abi as Abi,
        creationCodes: {
          membershipToken: membershipToken.bytecode as `0x${string}`,
          timelock: timelock.bytecode as `0x${string}`,
          governor: governor.bytecode as `0x${string}`,
          countingMultiChoice: countingMultiChoice.bytecode as `0x${string}`,
          verifierPowerToken: verifierPowerToken.bytecode as `0x${string}`,
          verifierElection: verifierElection.bytecode as `0x${string}`,
          verifierManager: verifierManager.bytecode as `0x${string}`,
          valuableActionRegistry: valuableActionRegistry.bytecode as `0x${string}`,
          valuableActionSBT: valuableActionSBT.bytecode as `0x${string}`,
          engagements: engagements.bytecode as `0x${string}`,
          positionManager: positionManager.bytecode as `0x${string}`,
          credentialManager: credentialManager.bytecode as `0x${string}`,
          cohortRegistry: cohortRegistry.bytecode as `0x${string}`,
          investmentCohortManager: investmentCohortManager.bytecode as `0x${string}`,
          revenueRouter: revenueRouter.bytecode as `0x${string}`,
          communityToken: communityToken.bytecode as `0x${string}`,
          treasuryAdapter: treasuryAdapter.bytecode as `0x${string}`,
          commerceDisputes: commerceDisputes.bytecode as `0x${string}`,
          marketplace: marketplace.bytecode as `0x${string}`,
          housingManager: housingManager.bytecode as `0x${string}`,
          projectFactory: projectFactory.bytecode as `0x${string}`,
          requestHub: requestHub.bytecode as `0x${string}`,
          draftsManager: draftsManager.bytecode as `0x${string}`,
          shiftAccessManager: shiftAccessManager.bytecode as `0x${string}`,
        },
      };
    })();
  }

  return factoryArtifactsPromise;
}

async function executeDeployStackWithFactories(
  params: {
    publicClient: PublicClient;
    writeContractAsync: WriteContractAsync;
    deployContractAsync?: DeployContractAsync;
    connectedAddress?: `0x${string}`;
  },
  session: DeploymentWizardSession,
  context: DeployContext,
): Promise<StepExecutionResult> {
  const txHashes: `0x${string}`[] = [];
  const { publicClient, writeContractAsync, connectedAddress } = params;
  const sharedInfra = resolveSharedInfra(context.preflight);
  const factories = resolveFactoryAddressesFromPreflight(context.preflight);
  if (!params.deployContractAsync) {
    throw new Error("Wallet deploy client unavailable. Reconnect wallet and retry deployment.");
  }
  const artifacts = await loadFactoryArtifacts();
  let runAddresses: Partial<DeploymentRunAddresses> = {
    ...(session.deploymentAddresses ?? {}),
    communityRegistry: sharedInfra.communityRegistry,
    paramController: sharedInfra.paramController,
  };
  const publishAddresses = (patch: Partial<DeploymentRunAddresses>) => {
    runAddresses = {
      ...runAddresses,
      ...patch,
    };
    context.onDeploymentAddresses?.(patch);
  };

  let nextNonce: bigint | undefined;
  const sender = requireAddressArg(
    connectedAddress ?? session.deployerAddress,
    "deployment sender",
  );
  if (connectedAddress) {
    const pendingNonce = await publicClient.getTransactionCount({
      address: connectedAddress,
      blockTag: "pending",
    });
    nextNonce = BigInt(pendingNonce);
  }
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  const accessManager = hasAddresses(runAddresses, ["accessManager"])
    ? requireAddressArg(runAddresses.accessManager, "run.accessManager")
    : await deployAndConfirm(
      params.deployContractAsync,
      publicClient,
      txHashes,
      {
        abi: SHIFT_ACCESS_MANAGER_ABI,
        bytecode: artifacts.creationCodes.shiftAccessManager,
        args: [sender],
      },
      connectedAddress,
      consumeNonce(),
      context.onTxConfirmed,
    );
  if (!hasAddresses(runAddresses, ["accessManager"])) {
    publishAddresses({ accessManager });
  }

  const bootstrapCoordinator = resolveBootstrapCoordinatorAddress();
  if (bootstrapCoordinator) {
    const coordinatorCode = await publicClient.getBytecode({ address: bootstrapCoordinator });
    if (coordinatorCode && coordinatorCode !== "0x") {
      const adminRole = (await publicClient.readContract({
        address: accessManager,
        abi: SHIFT_ACCESS_MANAGER_ABI,
        functionName: "ADMIN_ROLE",
      })) as bigint;

      const coordinatorHasAdmin = ((await publicClient.readContract({
        address: accessManager,
        abi: SHIFT_ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [adminRole, bootstrapCoordinator],
      })) as readonly [boolean, number])[0];

      if (!coordinatorHasAdmin) {
        await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
          address: accessManager,
          abi: SHIFT_ACCESS_MANAGER_ABI,
          functionName: "grantRole",
          args: [adminRole, bootstrapCoordinator, 0],
        }, connectedAddress, consumeNonce(), context.onTxConfirmed);
      }
    }
  }

  const nextCommunityId = (await publicClient.readContract({
    address: sharedInfra.communityRegistry,
    abi: COMMUNITY_REGISTRY_ABI,
    functionName: "nextCommunityId",
  })) as bigint;

  let governance:
    | {
      membershipToken: `0x${string}`;
      timelock: `0x${string}`;
      governor: `0x${string}`;
      countingMultiChoice: `0x${string}`;
    }
    | undefined;

  if (hasAddresses(runAddresses, ["membershipToken", "timelock", "governor"])) {
    governance = {
      membershipToken: requireAddressArg(runAddresses.membershipToken, "run.membershipToken"),
      timelock: requireAddressArg(runAddresses.timelock, "run.timelock"),
      governor: requireAddressArg(runAddresses.governor, "run.governor"),
      countingMultiChoice: ZERO_ADDRESS as `0x${string}`,
    };
  } else {
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: factories.governance,
      abi: artifacts.governanceAbi,
      functionName: "deployLayer",
      args: [
        nextCommunityId,
        context.config.communityName,
        accessManager,
        21600n,
        sender,
        artifacts.creationCodes.membershipToken,
        artifacts.creationCodes.timelock,
        artifacts.creationCodes.governor,
        artifacts.creationCodes.countingMultiChoice,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    const governanceRaw = await publicClient.readContract({
      address: factories.governance,
      abi: artifacts.governanceAbi,
      functionName: "lastDeploymentByCaller",
      args: [sender],
    });
    governance = normalizeGovernanceDeployment(governanceRaw);
    publishAddresses({
      membershipToken: governance.membershipToken,
      timelock: governance.timelock,
      governor: governance.governor,
    });
  }

  let verification:
    | {
      verifierPowerToken: `0x${string}`;
      verifierElection: `0x${string}`;
      verifierManager: `0x${string}`;
      valuableActionRegistry: `0x${string}`;
      valuableActionSBT: `0x${string}`;
      engagements: `0x${string}`;
      positionManager: `0x${string}`;
      credentialManager: `0x${string}`;
    }
    | undefined;

  if (hasAddresses(runAddresses, ["verifierPowerToken", "verifierElection", "verifierManager", "valuableActionRegistry", "valuableActionSBT", "engagements"])) {
    verification = {
      verifierPowerToken: requireAddressArg(runAddresses.verifierPowerToken, "run.verifierPowerToken"),
      verifierElection: requireAddressArg(runAddresses.verifierElection, "run.verifierElection"),
      verifierManager: requireAddressArg(runAddresses.verifierManager, "run.verifierManager"),
      valuableActionRegistry: requireAddressArg(runAddresses.valuableActionRegistry, "run.valuableActionRegistry"),
      valuableActionSBT: requireAddressArg(runAddresses.valuableActionSBT, "run.valuableActionSBT"),
      engagements: requireAddressArg(runAddresses.engagements, "run.engagements"),
      positionManager: ZERO_ADDRESS as `0x${string}`,
      credentialManager: ZERO_ADDRESS as `0x${string}`,
    };
  } else {
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: factories.verification,
      abi: artifacts.verificationAbi,
      functionName: "deployLayer",
      args: [
        nextCommunityId,
        accessManager,
        sharedInfra.communityRegistry,
        governance.timelock,
        sharedInfra.paramController,
        governance.membershipToken,
        "ipfs://shift/vpt",
        artifacts.creationCodes.verifierPowerToken,
        artifacts.creationCodes.verifierElection,
        artifacts.creationCodes.verifierManager,
        artifacts.creationCodes.valuableActionRegistry,
        artifacts.creationCodes.valuableActionSBT,
        artifacts.creationCodes.engagements,
        artifacts.creationCodes.positionManager,
        artifacts.creationCodes.credentialManager,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    const verificationRaw = await publicClient.readContract({
      address: factories.verification,
      abi: artifacts.verificationAbi,
      functionName: "lastDeploymentByCaller",
      args: [sender],
    });
    verification = normalizeVerificationDeployment(verificationRaw);
    publishAddresses({
      verifierPowerToken: verification.verifierPowerToken,
      verifierElection: verification.verifierElection,
      verifierManager: verification.verifierManager,
      positionManager: verification.positionManager,
      valuableActionRegistry: verification.valuableActionRegistry,
      valuableActionSBT: verification.valuableActionSBT,
      engagements: verification.engagements,
    });
  }

  const supportedTokens = parseAddresses(context.config.supportedTokensCsv);
  const treasuryStableToken = requireAddressArg(
    supportedTokens[0] ?? context.config.treasuryStableToken,
    "treasury stable token",
  );
  const treasuryVault = requireAddressArg(context.config.treasuryVault, "treasury vault");

  let economic:
    | {
      cohortRegistry: `0x${string}`;
      investmentCohortManager: `0x${string}`;
      revenueRouter: `0x${string}`;
      communityToken: `0x${string}`;
      treasuryAdapter: `0x${string}`;
    }
    | undefined;

  if (hasAddresses(runAddresses, ["revenueRouter", "communityToken", "treasuryAdapter"])) {
    economic = {
      cohortRegistry: ZERO_ADDRESS as `0x${string}`,
      investmentCohortManager: ZERO_ADDRESS as `0x${string}`,
      revenueRouter: requireAddressArg(runAddresses.revenueRouter, "run.revenueRouter"),
      communityToken: requireAddressArg(runAddresses.communityToken, "run.communityToken"),
      treasuryAdapter: requireAddressArg(runAddresses.treasuryAdapter, "run.treasuryAdapter"),
    };
  } else {
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: factories.economic,
      abi: artifacts.economicAbi,
      functionName: "deployLayer",
      args: [
        nextCommunityId,
        context.config.communityName,
        accessManager,
        sharedInfra.paramController,
        sharedInfra.communityRegistry,
        verification.valuableActionRegistry,
        verification.valuableActionSBT,
        treasuryStableToken,
        treasuryVault,
        artifacts.creationCodes.cohortRegistry,
        artifacts.creationCodes.investmentCohortManager,
        artifacts.creationCodes.revenueRouter,
        artifacts.creationCodes.communityToken,
        artifacts.creationCodes.treasuryAdapter,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    const economicRaw = await publicClient.readContract({
      address: factories.economic,
      abi: artifacts.economicAbi,
      functionName: "lastDeploymentByCaller",
      args: [sender],
    });
    economic = normalizeEconomicDeployment(economicRaw);
    publishAddresses({
      revenueRouter: economic.revenueRouter,
      communityToken: economic.communityToken,
      treasuryAdapter: economic.treasuryAdapter,
    });
  }

  let commerce:
    | {
      commerceDisputes: `0x${string}`;
      marketplace: `0x${string}`;
      housingManager: `0x${string}`;
      projectFactory: `0x${string}`;
    }
    | undefined;

  if (hasAddresses(runAddresses, ["marketplace"])) {
    commerce = {
      commerceDisputes: ZERO_ADDRESS as `0x${string}`,
      marketplace: requireAddressArg(runAddresses.marketplace, "run.marketplace"),
      housingManager: ZERO_ADDRESS as `0x${string}`,
      projectFactory: ZERO_ADDRESS as `0x${string}`,
    };
  } else {
    const commerceDeployResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: factories.commerce,
      abi: artifacts.commerceAbi,
      functionName: "deployLayer",
      args: [
        nextCommunityId,
        accessManager,
        treasuryStableToken,
        economic.revenueRouter,
        artifacts.creationCodes.commerceDisputes,
        artifacts.creationCodes.marketplace,
        artifacts.creationCodes.housingManager,
        artifacts.creationCodes.projectFactory,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    try {
      const commerceRaw = await publicClient.readContract({
        address: factories.commerce,
        abi: artifacts.commerceAbi,
        functionName: "lastDeploymentByCaller",
        args: [sender],
      });
      commerce = normalizeCommerceDeployment(commerceRaw);
    } catch {
      const fromEvent = decodeCommerceDeploymentFromReceipt(
        artifacts.commerceAbi,
        commerceDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
      );
      if (!fromEvent) {
        throw new Error(
          "Unable to resolve commerce layer deployment addresses from factory mapping or tx logs.",
        );
      }
      commerce = fromEvent;
    }
    publishAddresses({ marketplace: commerce.marketplace });
  }

  let coordination:
    | {
      requestHub: `0x${string}`;
      draftsManager: `0x${string}`;
    }
    | undefined;

  if (hasAddresses(runAddresses, ["requestHub", "draftsManager"])) {
    coordination = {
      requestHub: requireAddressArg(runAddresses.requestHub, "run.requestHub"),
      draftsManager: requireAddressArg(runAddresses.draftsManager, "run.draftsManager"),
    };
  } else {
    const coordinationDeployResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: factories.coordination,
      abi: artifacts.coordinationAbi,
      functionName: "deployLayer",
      args: [
        nextCommunityId,
        sharedInfra.communityRegistry,
        verification.valuableActionRegistry,
        governance.governor,
        accessManager,
        artifacts.creationCodes.requestHub,
        artifacts.creationCodes.draftsManager,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    try {
      const coordinationRaw = await publicClient.readContract({
        address: factories.coordination,
        abi: artifacts.coordinationAbi,
        functionName: "lastDeploymentByCaller",
        args: [sender],
      });
      coordination = normalizeCoordinationDeployment(coordinationRaw);
    } catch {
      const fromEvent = decodeCoordinationDeploymentFromReceipt(
        artifacts.coordinationAbi,
        coordinationDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
      );
      if (!fromEvent) {
        throw new Error(
          "Unable to resolve coordination layer deployment addresses from factory mapping or tx logs.",
        );
      }
      coordination = fromEvent;
    }
    publishAddresses({
      requestHub: coordination.requestHub,
      draftsManager: coordination.draftsManager,
    });
  }

  const deploymentAddresses: DeploymentRunAddresses = {
    communityRegistry: requireAddressArg(runAddresses.communityRegistry, "run.communityRegistry"),
    paramController: requireAddressArg(runAddresses.paramController, "run.paramController"),
    accessManager: requireAddressArg(runAddresses.accessManager ?? accessManager, "run.accessManager"),
    governor: requireAddressArg(runAddresses.governor ?? governance.governor, "run.governor"),
    timelock: requireAddressArg(runAddresses.timelock ?? governance.timelock, "run.timelock"),
    requestHub: requireAddressArg(runAddresses.requestHub ?? coordination.requestHub, "run.requestHub"),
    draftsManager: requireAddressArg(runAddresses.draftsManager ?? coordination.draftsManager, "run.draftsManager"),
    engagements: requireAddressArg(runAddresses.engagements ?? verification.engagements, "run.engagements"),
    positionManager: requireAddressArg(runAddresses.positionManager ?? verification.positionManager, "run.positionManager"),
    valuableActionRegistry: requireAddressArg(runAddresses.valuableActionRegistry ?? verification.valuableActionRegistry, "run.valuableActionRegistry"),
    verifierPowerToken: requireAddressArg(runAddresses.verifierPowerToken ?? verification.verifierPowerToken, "run.verifierPowerToken"),
    verifierElection: requireAddressArg(runAddresses.verifierElection ?? verification.verifierElection, "run.verifierElection"),
    verifierManager: requireAddressArg(runAddresses.verifierManager ?? verification.verifierManager, "run.verifierManager"),
    valuableActionSBT: requireAddressArg(runAddresses.valuableActionSBT ?? verification.valuableActionSBT, "run.valuableActionSBT"),
    treasuryAdapter: requireAddressArg(runAddresses.treasuryAdapter ?? economic.treasuryAdapter, "run.treasuryAdapter"),
    communityToken: requireAddressArg(runAddresses.communityToken ?? economic.communityToken, "run.communityToken"),
    revenueRouter: requireAddressArg(runAddresses.revenueRouter ?? economic.revenueRouter, "run.revenueRouter"),
    marketplace: requireAddressArg(runAddresses.marketplace ?? commerce.marketplace, "run.marketplace"),
  };
  publishAddresses(deploymentAddresses);

  return {
    txHashes,
    deploymentAddresses,
  };
}

async function registerAndWireCommunity(
  params: {
    publicClient: PublicClient;
    writeContractAsync: WriteContractAsync;
    connectedAddress?: `0x${string}`;
  },
  session: DeploymentWizardSession,
  context: DeployContext,
): Promise<StepExecutionResult> {
  const txHashes: `0x${string}`[] = [];
  const { publicClient, writeContractAsync, connectedAddress } = params;
  const sharedInfra = resolveSharedInfra(context.preflight);
  const runAddresses = session.deploymentAddresses;

  if (!runAddresses) {
    throw new Error("DEPLOY_STACK must complete before wiring. Missing run-scoped deployment addresses.");
  }

  let nextNonce: bigint | undefined;
  if (connectedAddress) {
    const pendingNonce = await publicClient.getTransactionCount({
      address: connectedAddress,
      blockTag: "pending",
    });
    nextNonce = BigInt(pendingNonce);
  }
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  const treasuryVault = requireAddressArg(context.config.treasuryVault, "treasury vault");
  const modulePayload = {
    governor: runAddresses.governor,
    timelock: runAddresses.timelock,
    requestHub: runAddresses.requestHub,
    draftsManager: runAddresses.draftsManager,
    engagementsManager: runAddresses.engagements,
    valuableActionRegistry: runAddresses.valuableActionRegistry,
    verifierPowerToken: runAddresses.verifierPowerToken,
    verifierElection: runAddresses.verifierElection,
    verifierManager: runAddresses.verifierManager,
    valuableActionSBT: runAddresses.valuableActionSBT,
    treasuryVault,
    treasuryAdapter: runAddresses.treasuryAdapter,
    communityToken: runAddresses.communityToken,
    paramController: runAddresses.paramController,
  };

  const beforeNextId = (await publicClient.readContract({
    address: sharedInfra.communityRegistry,
    abi: COMMUNITY_REGISTRY_ABI,
    functionName: "nextCommunityId",
  })) as bigint;

  const decodeCommunityId = (receipt: { logs?: unknown }, fallbackBefore: bigint, fallbackAfter: bigint): number => {
    let communityIdFromEvent: bigint | null = null;
    const logs = Array.isArray((receipt as { logs?: unknown }).logs)
      ? ((receipt as { logs: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> }).logs)
      : [];
    for (const rawLog of logs) {
      try {
        const decoded = decodeEventLog({
          abi: COMMUNITY_REGISTRY_ABI,
          data: rawLog.data,
          topics: rawLog.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        if (decoded.eventName === "CommunityRegistered") {
          communityIdFromEvent = decoded.args.communityId as bigint;
          break;
        }
      } catch {
        // Ignore unrelated logs.
      }
    }
    const derivedCommunityId =
      communityIdFromEvent ??
      (fallbackAfter > 0n ? fallbackAfter - 1n : fallbackBefore);
    return Number(derivedCommunityId);
  };

  try {
    const bootstrapResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.communityRegistry,
      abi: COMMUNITY_REGISTRY_ABI,
      functionName: "bootstrapCommunity",
      args: [
        context.config.communityName,
        context.config.communityDescription,
        context.config.communityMetadataUri,
        0n,
        {
          verifierPanelSize: 5n,
          verifierMin: 3n,
          maxPanelsPerEpoch: 20n,
          useVPTWeighting: true,
          maxWeightPerVerifier: 1000n,
          cooldownAfterFraud: 86400n,
          debateWindow: 7200n,
          voteWindow: 86400n,
          executionDelay: 21600n,
          minSeniority: 0n,
          minSBTs: 0n,
          proposalThreshold: 0n,
          minTreasuryBps: 1000,
          minPositionsBps: 2000,
          spilloverTarget: 1,
          spilloverSplitBpsToTreasury: 5000,
        },
        modulePayload,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    const afterNextId = (await publicClient.readContract({
      address: sharedInfra.communityRegistry,
      abi: COMMUNITY_REGISTRY_ABI,
      functionName: "nextCommunityId",
    })) as bigint;

    return {
      txHashes,
      communityId: decodeCommunityId(bootstrapResult.receipt as { logs?: unknown }, beforeNextId, afterNextId),
    };
  } catch {
    // Compatibility fallback for older registry deployments that do not include bootstrapCommunity.
    const registerResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.communityRegistry,
      abi: COMMUNITY_REGISTRY_ABI,
      functionName: "registerCommunity",
      args: [
        context.config.communityName,
        context.config.communityDescription,
        context.config.communityMetadataUri,
        0n,
      ],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    const afterNextId = (await publicClient.readContract({
      address: sharedInfra.communityRegistry,
      abi: COMMUNITY_REGISTRY_ABI,
      functionName: "nextCommunityId",
    })) as bigint;

    const communityId = decodeCommunityId(registerResult.receipt as { logs?: unknown }, beforeNextId, afterNextId);

    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.paramController,
      abi: PARAM_CONTROLLER_ABI,
      functionName: "setVerifierParams",
      args: [BigInt(communityId), 5n, 3n, 20n, true, 1000n, 86400n],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.paramController,
      abi: PARAM_CONTROLLER_ABI,
      functionName: "setGovernanceParams",
      args: [BigInt(communityId), 7200n, 86400n, 21600n],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.paramController,
      abi: PARAM_CONTROLLER_ABI,
      functionName: "setEligibilityParams",
      args: [BigInt(communityId), 0n, 0n, 0n],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.paramController,
      abi: PARAM_CONTROLLER_ABI,
      functionName: "setRevenuePolicy",
      args: [BigInt(communityId), 1000n, 2000n, 1n, 5000n],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: sharedInfra.communityRegistry,
      abi: COMMUNITY_REGISTRY_ABI,
      functionName: "setModuleAddresses",
      args: [BigInt(communityId), modulePayload],
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    return { txHashes, communityId };
  }
}

export function createFactoryDeployStepExecutor(params: {
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  deployContractAsync?: DeployContractAsync;
  connectedAddress?: `0x${string}`;
}): StepExecutor {
  const baseExecutor = createDefaultUserSignedStepExecutor(params);

  return async (step, session, context) => {
    assertStrictStagingMode(context.chainId);

    if (step === "DEPLOY_STACK") {
      return executeDeployStackWithFactories(params, session, context);
    }

    if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
      const wiringResult = await registerAndWireCommunity(params, session, context);
      const syntheticSession: DeploymentWizardSession = {
        ...session,
        communityId: wiringResult.communityId,
      };
      const baseResult = await baseExecutor(step, syntheticSession, context);
      return {
        txHashes: [...(wiringResult.txHashes ?? []), ...(baseResult.txHashes ?? [])],
        communityId: wiringResult.communityId,
        deploymentAddresses: baseResult.deploymentAddresses ?? session.deploymentAddresses,
      };
    }

    return baseExecutor(step, session, context);
  };
}
