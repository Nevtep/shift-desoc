import type { Abi, PublicClient } from "viem";
import { decodeEventLog, encodeDeployData, encodeFunctionData, keccak256, stringToBytes } from "viem";
import { getAddress } from "viem";

import type { StepExecutor, StepExecutionResult, WriteContractAsync } from "./step-executor-types";
import type {
  CommunityDeploymentConfig,
} from "./config";
import type {
  DeploymentRunAddresses,
  DeploymentWizardSession,
  PreflightAssessment,
} from "./types";

const STRICT_STAGING_CHAIN_ID = 84532;
const LEGACY_MODE_ENV_FLAGS = [
  "NEXT_PUBLIC_SHIFT_ENABLE_LEGACY_DEPLOY",
  "NEXT_PUBLIC_SHIFT_ENABLE_BACKFILL",
  "NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE"
] as const;

const FACTORY_ENV_KEYS = {
  governance: "NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY",
  verification: "NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY",
  economic: "NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY",
  commerce: "NEXT_PUBLIC_COMMERCE_LAYER_FACTORY",
  coordination: "NEXT_PUBLIC_COORDINATION_LAYER_FACTORY",
  bootstrapCoordinator: "NEXT_PUBLIC_BOOTSTRAP_COORDINATOR",
} as const;

const FACTORY_ENV_VALUES = {
  governance: process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY,
  verification: process.env.NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY,
  economic: process.env.NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY,
  commerce: process.env.NEXT_PUBLIC_COMMERCE_LAYER_FACTORY,
  coordination: process.env.NEXT_PUBLIC_COORDINATION_LAYER_FACTORY,
  bootstrapCoordinator: process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR,
} as const;

const FORCE_MANUAL_NONCE = process.env.NEXT_PUBLIC_SHIFT_FORCE_MANUAL_NONCE === "1";

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
  },
  {
    type: "function",
    name: "setTargetFunctionRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bytes4[]" }, { type: "uint64" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getTargetFunctionRole",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "bytes4" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint64" }, { type: "address" }],
    outputs: [],
  }
] as const satisfies Abi;

const VERIFIER_POWER_TOKEN_ABI = [
  {
    type: "function",
    name: "communityInitialized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "communityInitialized",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "initializeCommunity",
    stateMutability: "nonpayable",
    inputs: [{ type: "string" }],
    outputs: []
  },
  {
    type: "function",
    name: "initializeCommunity",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "string" }],
    outputs: []
  }
] as const satisfies Abi;

const VALUABLE_ACTION_REGISTRY_ABI = [
  {
    type: "function",
    name: "valuableActionSBT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "isIssuanceModule",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "founderWhitelist",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "setValuableActionSBT",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "setIssuanceModule",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "addFounder",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "addFounder",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: []
  }
] as const satisfies Abi;

const REVENUE_ROUTER_ABI = [
  {
    type: "function",
    name: "communityTreasuries",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "supportedTokens",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "setCommunityTreasury",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "setSupportedToken",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bool" }],
    outputs: []
  }
] as const satisfies Abi;

const TREASURY_ADAPTER_ABI = [
  {
    type: "function",
    name: "tokenAllowed",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "tokenAllowed",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "capBps",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint16" }]
  },
  {
    type: "function",
    name: "capBps",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint16" }]
  },
  {
    type: "function",
    name: "destinationAllowed",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "destinationAllowed",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "setTokenAllowed",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "setTokenAllowed",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }, { type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "setCapBps",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint16" }],
    outputs: []
  },
  {
    type: "function",
    name: "setCapBps",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }, { type: "uint16" }],
    outputs: []
  },
  {
    type: "function",
    name: "setDestinationAllowed",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "setDestinationAllowed",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }, { type: "bool" }],
    outputs: []
  }
] as const satisfies Abi;

const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "communityActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "communityTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "setCommunityActive",
    stateMutability: "nonpayable",
    inputs: [{ type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "setCommunityToken",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }],
    outputs: []
  }
] as const satisfies Abi;

const ACCESS_MANAGED_AUTHORITY_ABI = [
  {
    type: "function",
    name: "authority",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  }
] as const satisfies Abi;

function isNonZeroAddress(value: unknown): value is `0x${string}` {
  if (typeof value !== "string") return false;
  if (!value.startsWith("0x") || value.length !== 42) return false;
  return value.toLowerCase() !== ZERO_ADDRESS;
}

const BOOTSTRAP_COORDINATOR_ABI = [
  {
    type: "function",
    name: "configureAccessManager",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address" },
      {
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "selectors", type: "bytes4[]" },
          { name: "role", type: "uint64" }
        ]
      },
      {
        type: "tuple[]",
        components: [
          { name: "role", type: "uint64" },
          { name: "account", type: "address" },
          { name: "executionDelay", type: "uint32" }
        ]
      }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "bootstrapAccessAndRuntime",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address" },
      {
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "selectors", type: "bytes4[]" },
          { name: "role", type: "uint64" }
        ]
      },
      {
        type: "tuple[]",
        components: [
          { name: "role", type: "uint64" },
          { name: "account", type: "address" },
          { name: "executionDelay", type: "uint32" }
        ]
      },
      {
        type: "tuple",
        components: [
          { name: "communityId", type: "uint256" },
          { name: "valuableActionRegistry", type: "address" },
          { name: "verifierPowerToken", type: "address" },
          { name: "requestHub", type: "address" },
          { name: "founder", type: "address" },
          { name: "valuableActionSBT", type: "address" },
          { name: "revenueRouter", type: "address" },
          { name: "treasuryAdapter", type: "address" },
          { name: "marketplace", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "treasuryVault", type: "address" },
          { name: "supportedTokens", type: "address[]" },
          { name: "tokenCapBps", type: "uint16" },
          { name: "verifierMetadataURI", type: "string" }
        ]
      }
    ],
    outputs: []
  }
] as const satisfies Abi;

const ACCESS_MANAGED_UNAUTHORIZED_SELECTOR = "0x068ca9d8";
const VPT_ELECTION_POWER_ROLE = 1001n;
const ROLES = {
  COHORT_REVENUE_ROUTER_ROLE: 1n,
  COHORT_INVESTMENT_RECORDER_ROLE: 2n,
  VALUABLE_ACTION_REGISTRY_ISSUER_ROLE: 3n,
  VALUABLE_ACTION_SBT_MANAGER_ROLE: 4n,
  VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE: 17n,
  REVENUE_ROUTER_DISTRIBUTOR_ROLE: 6n,
  REVENUE_ROUTER_POSITION_MANAGER_ROLE: 7n,
  MEMBERSHIP_TOKEN_MINTER_ROLE: 11n,
  MEMBERSHIP_TOKEN_GOVERNANCE_ROLE: 12n,
  VERIFIER_MANAGER_CALLER_ROLE: 15n,
  CREDENTIAL_MANAGER_APPROVER_ROLE: 16n,
  COMMERCE_DISPUTES_CALLER_ROLE: 13n,
  HOUSING_MARKETPLACE_CALLER_ROLE: 14n
} as const;

const BASE_DEPLOY_FALLBACK_GAS = 900000n;
const DEPLOY_LAYER_FALLBACK_GAS = 6000000n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const WIZARD_REQUIRED_CONFIRMATIONS = 3;
const GAS_FALLBACK_BY_FUNCTION: Record<string, bigint> = {
  registerCommunity: 600000n,
  setVerifierParams: 450000n,
  setGovernanceParams: 350000n,
  setEligibilityParams: 300000n,
  setRevenuePolicy: 350000n,
  setModuleAddresses: 900000n,
  initializeCommunity: 350000n,
  setValuableActionSBT: 250000n,
  setIssuanceModule: 250000n,
  addFounder: 250000n,
  setCommunityTreasury: 250000n,
  setSupportedToken: 250000n,
  setTokenAllowed: 250000n,
  setCapBps: 250000n,
  setDestinationAllowed: 250000n,
  setCommunityActive: 250000n,
  setCommunityToken: 250000n,
  configureAccessManager: 800000n,
  bootstrapAccessAndRuntime: 1800000n,
  grantRole: 250000n,
  revokeRole: 250000n
};

function requireAddressArg(value: unknown, label: string): `0x${string}` {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: expected 20-byte 0x address, received ${String(value)}.`);
  }
  if (value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`Invalid ${label}: received zero address.`);
  }
  return value as `0x${string}`;
}

function selector(signature: string): `0x${string}` {
  return `0x${keccak256(stringToBytes(signature)).slice(2, 10)}` as `0x${string}`;
}

function requireRunScopedAddresses(session: DeploymentWizardSession): DeploymentRunAddresses {
  if (!session.deploymentAddresses) {
    throw new Error(
      "Missing run-scoped deployment addresses. DEPLOY_STACK must complete and persist addresses before mutable steps."
    );
  }
  return session.deploymentAddresses;
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

function decodeGovernanceDeploymentFromReceipt(
  factoryAbi: Abi,
  receipt: { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
): {
  membershipToken: `0x${string}`;
  timelock: `0x${string}`;
  governor: `0x${string}`;
  countingMultiChoice: `0x${string}`;
} | null {
  const logs = receipt.logs ?? [];
  for (const rawLog of logs) {
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: rawLog.data,
        topics: rawLog.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "GovernanceLayerDeployed") continue;
      const args = decoded.args as {
        membershipToken?: unknown;
        timelock?: unknown;
        governor?: unknown;
        countingMultiChoice?: unknown;
      };
      return {
        membershipToken: requireAddressArg(args.membershipToken, "governance.event.membershipToken"),
        timelock: requireAddressArg(args.timelock, "governance.event.timelock"),
        governor: requireAddressArg(args.governor, "governance.event.governor"),
        countingMultiChoice: requireAddressArg(args.countingMultiChoice, "governance.event.countingMultiChoice"),
      };
    } catch {
      // Ignore unrelated logs.
    }
  }
  return null;
}

function decodeVerificationDeploymentFromReceipt(
  factoryAbi: Abi,
  receipt: { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
): {
  verifierPowerToken: `0x${string}`;
  verifierElection: `0x${string}`;
  verifierManager: `0x${string}`;
  valuableActionRegistry: `0x${string}`;
  valuableActionSBT: `0x${string}`;
  engagements: `0x${string}`;
  positionManager: `0x${string}`;
  credentialManager: `0x${string}`;
} | null {
  const logs = receipt.logs ?? [];
  for (const rawLog of logs) {
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: rawLog.data,
        topics: rawLog.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "VerificationLayerDeployed") continue;
      const args = decoded.args as {
        verifierPowerToken?: unknown;
        verifierElection?: unknown;
        verifierManager?: unknown;
        valuableActionRegistry?: unknown;
        valuableActionSBT?: unknown;
        engagements?: unknown;
        positionManager?: unknown;
        credentialManager?: unknown;
      };
      return {
        verifierPowerToken: requireAddressArg(args.verifierPowerToken, "verification.event.verifierPowerToken"),
        verifierElection: requireAddressArg(args.verifierElection, "verification.event.verifierElection"),
        verifierManager: requireAddressArg(args.verifierManager, "verification.event.verifierManager"),
        valuableActionRegistry: requireAddressArg(args.valuableActionRegistry, "verification.event.valuableActionRegistry"),
        valuableActionSBT: requireAddressArg(args.valuableActionSBT, "verification.event.valuableActionSBT"),
        engagements: requireAddressArg(args.engagements, "verification.event.engagements"),
        positionManager: requireAddressArg(args.positionManager, "verification.event.positionManager"),
        credentialManager: requireAddressArg(args.credentialManager, "verification.event.credentialManager"),
      };
    } catch {
      // Ignore unrelated logs.
    }
  }
  return null;
}

function decodeEconomicDeploymentFromReceipt(
  factoryAbi: Abi,
  receipt: { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
): {
  cohortRegistry: `0x${string}`;
  investmentCohortManager: `0x${string}`;
  revenueRouter: `0x${string}`;
  communityToken: `0x${string}`;
  treasuryAdapter: `0x${string}`;
} | null {
  const logs = receipt.logs ?? [];
  for (const rawLog of logs) {
    try {
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: rawLog.data,
        topics: rawLog.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "EconomicLayerDeployed") continue;
      const args = decoded.args as {
        cohortRegistry?: unknown;
        investmentCohortManager?: unknown;
        revenueRouter?: unknown;
        communityToken?: unknown;
        treasuryAdapter?: unknown;
      };
      return {
        cohortRegistry: requireAddressArg(args.cohortRegistry, "economic.event.cohortRegistry"),
        investmentCohortManager: requireAddressArg(args.investmentCohortManager, "economic.event.investmentCohortManager"),
        revenueRouter: requireAddressArg(args.revenueRouter, "economic.event.revenueRouter"),
        communityToken: requireAddressArg(args.communityToken, "economic.event.communityToken"),
        treasuryAdapter: requireAddressArg(args.treasuryAdapter, "economic.event.treasuryAdapter"),
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

  const enabledLegacyFlags = LEGACY_MODE_ENV_FLAGS.filter((flag) => {
    const value = process.env[flag];
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  });
  if (enabledLegacyFlags.length > 0) {
    throw new Error(
      `Legacy deploy modes are disabled in strict staging mode. Unset: ${enabledLegacyFlags.join(", ")}.`,
    );
  }
}

function requiredAddress(value: string | undefined, label: string): `0x${string}` {
  if (!value) {
    throw new Error(`Missing ${label}. Set the corresponding NEXT_PUBLIC_* env var for wizard factory deploy.`);
  }
  try {
    return getAddress(value) as `0x${string}`;
  } catch {
    throw new Error(`Invalid ${label}. Set a valid 20-byte EVM address in the corresponding NEXT_PUBLIC_* env var.`);
  }
}

function resolveFactoryAddresses(): FactoryAddresses {
  return {
    governance: requiredAddress(FACTORY_ENV_VALUES.governance, FACTORY_ENV_KEYS.governance),
    verification: requiredAddress(FACTORY_ENV_VALUES.verification, FACTORY_ENV_KEYS.verification),
    economic: requiredAddress(FACTORY_ENV_VALUES.economic, FACTORY_ENV_KEYS.economic),
    commerce: requiredAddress(FACTORY_ENV_VALUES.commerce, FACTORY_ENV_KEYS.commerce),
    coordination: requiredAddress(FACTORY_ENV_VALUES.coordination, FACTORY_ENV_KEYS.coordination),
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
  const value = process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR ?? FACTORY_ENV_VALUES.bootstrapCoordinator;
  if (!value) {
    return undefined;
  }
  try {
    return getAddress(value) as `0x${string}`;
  } catch {
    return undefined;
  }
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

async function isUsableAccessManager(
  publicClient: PublicClient,
  candidate: `0x${string}`,
): Promise<boolean> {
  const bytecode = await publicClient.getBytecode({ address: candidate });
  if (!bytecode || bytecode === "0x") return false;

  try {
    await publicClient.readContract({
      address: candidate,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "ADMIN_ROLE",
    });
    return true;
  } catch {
    return false;
  }
}

const ACCESS_MANAGER_READY_RETRIES = 10;
const ACCESS_MANAGER_READY_DELAY_MS = 1200;
const FACTORY_DEPLOYMENT_READ_RETRIES = 8;
const FACTORY_DEPLOYMENT_READ_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isZeroAddressNormalizationError(error: unknown): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("received zero address");
}

async function readFactoryDeploymentWithRetry<T>(
  publicClient: PublicClient,
  factoryAddress: `0x${string}`,
  factoryAbi: Abi,
  sender: `0x${string}`,
  normalize: (raw: unknown) => T,
  opts?: { retries?: number; delayMs?: number }
): Promise<T> {
  const retries = opts?.retries ?? FACTORY_DEPLOYMENT_READ_RETRIES;
  const delayMs = opts?.delayMs ?? FACTORY_DEPLOYMENT_READ_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await publicClient.readContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "lastDeploymentByCaller",
        args: [sender],
      });
      return normalize(raw);
    } catch (error) {
      lastError = error;
      if (!isZeroAddressNormalizationError(error) || attempt === retries) {
        break;
      }
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function readHasRoleWithRetry(
  publicClient: PublicClient,
  accessManager: `0x${string}`,
  role: bigint,
  account: `0x${string}`,
  opts?: { retries?: number; delayMs?: number }
): Promise<boolean> {
  const retries = opts?.retries ?? ACCESS_MANAGER_READY_RETRIES;
  const delayMs = opts?.delayMs ?? ACCESS_MANAGER_READY_DELAY_MS;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const hasRole = ((await publicClient.readContract({
      address: accessManager,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "hasRole",
      args: [role, account]
    })) as readonly [boolean, number])[0];

    if (hasRole || attempt === retries) return hasRole;
    await sleep(delayMs);
  }

  return false;
}

async function readAccessManagerAdminRoleWithRetry(
  publicClient: PublicClient,
  accessManager: `0x${string}`,
  opts?: { retries?: number; delayMs?: number }
): Promise<bigint> {
  const retries = opts?.retries ?? ACCESS_MANAGER_READY_RETRIES;
  const delayMs = opts?.delayMs ?? ACCESS_MANAGER_READY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return (await publicClient.readContract({
        address: accessManager,
        abi: SHIFT_ACCESS_MANAGER_ABI,
        functionName: "ADMIN_ROLE",
      })) as bigint;
    } catch (error) {
      lastError = error;

      if (attempt === retries) break;

      // Freshly deployed contracts can be temporarily unavailable on some RPC backends.
      await sleep(delayMs);
    }
  }

  const bytecode = await publicClient.getBytecode({ address: accessManager }).catch(() => undefined);
  const bytecodeState = !bytecode || bytecode === "0x" ? "no-code" : "has-code";
  throw new Error(
    `Invalid AccessManager at ${accessManager}. Failed reading ADMIN_ROLE after ${retries + 1} attempts (${bytecodeState}). Last error: ${String(lastError)}`
  );
}

async function initializeNonceCursor(
  publicClient: PublicClient,
  connectedAddress?: `0x${string}`
): Promise<bigint | undefined> {
  if (!connectedAddress || !FORCE_MANUAL_NONCE) {
    return undefined;
  }

  const pendingNonce = await publicClient.getTransactionCount({
    address: connectedAddress,
    blockTag: "pending",
  });
  return BigInt(pendingNonce);
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
  } catch (error) {
    const rawError = String(error ?? "");
    if (
      rawError.includes(ACCESS_MANAGED_UNAUTHORIZED_SELECTOR) ||
      rawError.includes("AccessManagedUnauthorized")
    ) {
      if (args.functionName === "bootstrapAccessAndRuntime" || args.functionName === "configureAccessManager") {
        // Public RPC nodes can return stale authorization state during estimation right after role wiring.
        // Send with fallback gas and let the receipt determine success/failure.
        return GAS_FALLBACK_BY_FUNCTION[args.functionName] ?? BASE_DEPLOY_FALLBACK_GAS;
      }
      throw new Error(
        `Unauthorized call for ${args.functionName}. Connected wallet lacks required AccessManager permission for this step.`
      );
    }

    if (args.functionName === "deployLayer") {
      return DEPLOY_LAYER_FALLBACK_GAS;
    }
    return GAS_FALLBACK_BY_FUNCTION[args.functionName] ?? BASE_DEPLOY_FALLBACK_GAS;
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
  const encodedData = (() => {
    try {
      return encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args as readonly unknown[] | undefined,
      });
    } catch {
      return "<encode-failed>";
    }
  })();

  console.log("[DeployWizard] Wallet tx request", {
    kind: "contract-write",
    address: args.address,
    functionName: args.functionName,
    args: args.args,
    account,
    manualNonceMode: FORCE_MANUAL_NONCE,
    nonce: typeof nonce === "bigint" ? nonce.toString() : undefined,
    gas: gas.toString(),
    data: encodedData,
  });
  const hash = await writeContractAsync({ ...args, gas, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: WIZARD_REQUIRED_CONFIRMATIONS,
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
  const encodedData = (() => {
    try {
      return encodeDeployData({
        abi: args.abi,
        bytecode: args.bytecode,
        args: args.args,
      });
    } catch {
      return "<encode-failed>";
    }
  })();

  console.log("[DeployWizard] Wallet tx request", {
    kind: "contract-deploy",
    account,
    manualNonceMode: FORCE_MANUAL_NONCE,
    nonce: typeof nonce === "bigint" ? nonce.toString() : undefined,
    gas: gas.toString(),
    bytecodeLength: args.bytecode.length,
    args: args.args,
    data: encodedData,
  });
  const hash = await deployContractAsync({ ...args, gas, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: WIZARD_REQUIRED_CONFIRMATIONS,
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

  const priorDeployStepTxHashes =
    session.steps.find((step) => step.key === "DEPLOY_STACK")?.txHashes ?? [];
  const hasPriorDeployProgress = priorDeployStepTxHashes.length > 0;

  const priorTouchedAddresses = new Set<string>();
  const priorContractDeployments: `0x${string}`[] = [];
  if (priorDeployStepTxHashes.length > 0) {
    for (const hash of priorDeployStepTxHashes) {
      try {
        const tx = await publicClient.getTransaction({ hash });
        if (tx.to) {
          priorTouchedAddresses.add(String(tx.to).toLowerCase());
        }
      } catch {
        // Ignore unavailable tx details and continue best-effort recovery.
      }

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash });
        if (receipt.contractAddress && receipt.contractAddress !== ZERO_ADDRESS) {
          priorContractDeployments.push(receipt.contractAddress as `0x${string}`);
        }
      } catch {
        // Ignore unavailable receipts and continue best-effort recovery.
      }
    }
  }

  const wasAddressTouchedInPriorTx = (address: `0x${string}`): boolean =>
    priorTouchedAddresses.has(address.toLowerCase());

  let nextNonce: bigint | undefined;
  const sender = requireAddressArg(
    connectedAddress ?? session.deployerAddress,
    "deployment sender",
  );
  nextNonce = await initializeNonceCursor(publicClient, connectedAddress);
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  let accessManager: `0x${string}`;
  let accessManagerFromPriorDeployProgress = false;
  const reuseAccessManager = hasPriorDeployProgress && hasAddresses(runAddresses, ["accessManager"])
    ? requireAddressArg(runAddresses.accessManager, "run.accessManager")
    : undefined;

  if (reuseAccessManager && (await isUsableAccessManager(publicClient, reuseAccessManager))) {
    accessManager = reuseAccessManager;
    accessManagerFromPriorDeployProgress = true;
    console.log("[DeployWizard] AccessManager selected from prior DEPLOY_STACK progress", {
      accessManager,
      hasPriorDeployProgress,
    });
  } else {
    let recoveredAccessManager: `0x${string}` | undefined;
    if (priorContractDeployments.length > 0) {
      for (const deployedAddress of priorContractDeployments) {
        if (await isUsableAccessManager(publicClient, deployedAddress)) {
          recoveredAccessManager = deployedAddress;
          break;
        }
      }
    }

    if (recoveredAccessManager) {
      console.log("[DeployWizard] Recovered AccessManager from prior DEPLOY_STACK tx receipts", {
        accessManager: recoveredAccessManager,
      });
      accessManager = recoveredAccessManager;
      accessManagerFromPriorDeployProgress = true;
      publishAddresses({ accessManager });
    } else {
    if (reuseAccessManager) {
      console.warn("[DeployWizard] Stored accessManager is not usable; redeploying", {
        storedAddress: reuseAccessManager,
      });
    }

    accessManager = await deployAndConfirm(
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
    publishAddresses({ accessManager });
    if (hasPriorDeployProgress) {
      console.warn("[DeployWizard] Prior DEPLOY_STACK progress exists but AccessManager was freshly redeployed; skipping prior layer recovery to avoid mixed authorities", {
        accessManager,
      });
    }
    console.log("[DeployWizard] AccessManager deployed", {
      accessManager,
      source: "deploy-contract",
    });
    }
  }

  const bootstrapCoordinator = resolveBootstrapCoordinatorAddress();
  if (bootstrapCoordinator) {
    const coordinatorCode = await publicClient.getBytecode({ address: bootstrapCoordinator });
    if (coordinatorCode && coordinatorCode !== "0x") {
      const adminRole = await readAccessManagerAdminRoleWithRetry(publicClient, accessManager);

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

  console.log("[DeployWizard] AccessManager selected for layer deploy args", {
    accessManager,
    nextCommunityId: Number(nextCommunityId),
  });

  let governance:
    | {
      membershipToken: `0x${string}`;
      timelock: `0x${string}`;
      governor: `0x${string}`;
      countingMultiChoice: `0x${string}`;
    }
    | undefined;

  if (accessManagerFromPriorDeployProgress && hasAddresses(runAddresses, ["membershipToken", "timelock", "governor"])) {
    governance = {
      membershipToken: requireAddressArg(runAddresses.membershipToken, "run.membershipToken"),
      timelock: requireAddressArg(runAddresses.timelock, "run.timelock"),
      governor: requireAddressArg(runAddresses.governor, "run.governor"),
      countingMultiChoice: ZERO_ADDRESS as `0x${string}`,
    };
  } else {
    if (accessManagerFromPriorDeployProgress && wasAddressTouchedInPriorTx(factories.governance)) {
      try {
        governance = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.governance,
          artifacts.governanceAbi,
          sender,
          normalizeGovernanceDeployment
        );
        console.log("[DeployWizard] Recovered governance layer from prior factory deployment mapping", {
          membershipToken: governance.membershipToken,
          timelock: governance.timelock,
          governor: governance.governor,
        });
        publishAddresses({
          membershipToken: governance.membershipToken,
          timelock: governance.timelock,
          governor: governance.governor,
        });
      } catch {
        // Fall through to normal deploy path.
      }
    }

    if (!governance) {
    const governanceDeployResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
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

    const fromEvent = decodeGovernanceDeploymentFromReceipt(
      artifacts.governanceAbi,
      governanceDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
    );
    if (fromEvent) {
      governance = fromEvent;
    } else {
      governance = await readFactoryDeploymentWithRetry(
        publicClient,
        factories.governance,
        artifacts.governanceAbi,
        sender,
        normalizeGovernanceDeployment
      );
    }
    publishAddresses({
      membershipToken: governance.membershipToken,
      timelock: governance.timelock,
      governor: governance.governor,
    });
    console.log("[DeployWizard] Governance layer deployed", {
      membershipToken: governance.membershipToken,
      timelock: governance.timelock,
      governor: governance.governor,
      countingMultiChoice: governance.countingMultiChoice,
    });
    }
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

  if (
    accessManagerFromPriorDeployProgress &&
    hasAddresses(runAddresses, [
      "verifierPowerToken",
      "verifierElection",
      "verifierManager",
      "valuableActionRegistry",
      "valuableActionSBT",
      "engagements",
      "positionManager",
      "credentialManager",
    ])
  ) {
    verification = {
      verifierPowerToken: requireAddressArg(runAddresses.verifierPowerToken, "run.verifierPowerToken"),
      verifierElection: requireAddressArg(runAddresses.verifierElection, "run.verifierElection"),
      verifierManager: requireAddressArg(runAddresses.verifierManager, "run.verifierManager"),
      valuableActionRegistry: requireAddressArg(runAddresses.valuableActionRegistry, "run.valuableActionRegistry"),
      valuableActionSBT: requireAddressArg(runAddresses.valuableActionSBT, "run.valuableActionSBT"),
      engagements: requireAddressArg(runAddresses.engagements, "run.engagements"),
      positionManager: requireAddressArg(runAddresses.positionManager, "run.positionManager"),
      credentialManager: requireAddressArg(runAddresses.credentialManager, "run.credentialManager"),
    };
  } else {
    if (accessManagerFromPriorDeployProgress && wasAddressTouchedInPriorTx(factories.verification)) {
      try {
        verification = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.verification,
          artifacts.verificationAbi,
          sender,
          normalizeVerificationDeployment
        );
        console.log("[DeployWizard] Recovered verification layer from prior factory deployment mapping", {
          verifierPowerToken: verification.verifierPowerToken,
          verifierElection: verification.verifierElection,
          verifierManager: verification.verifierManager,
        });
        publishAddresses({
          verifierPowerToken: verification.verifierPowerToken,
          verifierElection: verification.verifierElection,
          verifierManager: verification.verifierManager,
          positionManager: verification.positionManager,
          credentialManager: verification.credentialManager,
          valuableActionRegistry: verification.valuableActionRegistry,
          valuableActionSBT: verification.valuableActionSBT,
          engagements: verification.engagements,
        });
      } catch {
        // Fall through to normal deploy path.
      }
    }

    if (!verification) {
    const verificationDeployResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
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

    const fromEvent = decodeVerificationDeploymentFromReceipt(
      artifacts.verificationAbi,
      verificationDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
    );
    if (fromEvent) {
      verification = fromEvent;
    } else {
      verification = await readFactoryDeploymentWithRetry(
        publicClient,
        factories.verification,
        artifacts.verificationAbi,
        sender,
        normalizeVerificationDeployment
      );
    }
    publishAddresses({
      verifierPowerToken: verification.verifierPowerToken,
      verifierElection: verification.verifierElection,
      verifierManager: verification.verifierManager,
      positionManager: verification.positionManager,
      credentialManager: verification.credentialManager,
      valuableActionRegistry: verification.valuableActionRegistry,
      valuableActionSBT: verification.valuableActionSBT,
      engagements: verification.engagements,
    });
    console.log("[DeployWizard] Verification layer deployed", {
      verifierPowerToken: verification.verifierPowerToken,
      verifierElection: verification.verifierElection,
      verifierManager: verification.verifierManager,
      valuableActionRegistry: verification.valuableActionRegistry,
      valuableActionSBT: verification.valuableActionSBT,
      engagements: verification.engagements,
      positionManager: verification.positionManager,
      credentialManager: verification.credentialManager,
    });
    }
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

  if (
    accessManagerFromPriorDeployProgress &&
    hasAddresses(runAddresses, ["cohortRegistry", "investmentCohortManager", "revenueRouter", "communityToken", "treasuryAdapter"])
  ) {
    economic = {
      cohortRegistry: requireAddressArg(runAddresses.cohortRegistry, "run.cohortRegistry"),
      investmentCohortManager: requireAddressArg(runAddresses.investmentCohortManager, "run.investmentCohortManager"),
      revenueRouter: requireAddressArg(runAddresses.revenueRouter, "run.revenueRouter"),
      communityToken: requireAddressArg(runAddresses.communityToken, "run.communityToken"),
      treasuryAdapter: requireAddressArg(runAddresses.treasuryAdapter, "run.treasuryAdapter"),
    };
  } else {
    if (accessManagerFromPriorDeployProgress && wasAddressTouchedInPriorTx(factories.economic)) {
      try {
        economic = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.economic,
          artifacts.economicAbi,
          sender,
          normalizeEconomicDeployment
        );
        console.log("[DeployWizard] Recovered economic layer from prior factory deployment mapping", {
          revenueRouter: economic.revenueRouter,
          communityToken: economic.communityToken,
          treasuryAdapter: economic.treasuryAdapter,
        });
        publishAddresses({
          cohortRegistry: economic.cohortRegistry,
          investmentCohortManager: economic.investmentCohortManager,
          revenueRouter: economic.revenueRouter,
          communityToken: economic.communityToken,
          treasuryAdapter: economic.treasuryAdapter,
        });
      } catch {
        // Fall through to normal deploy path.
      }
    }

    if (!economic) {
    const economicDeployResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
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

    const fromEvent = decodeEconomicDeploymentFromReceipt(
      artifacts.economicAbi,
      economicDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
    );
    if (fromEvent) {
      economic = fromEvent;
    } else {
      economic = await readFactoryDeploymentWithRetry(
        publicClient,
        factories.economic,
        artifacts.economicAbi,
        sender,
        normalizeEconomicDeployment
      );
    }
    publishAddresses({
      cohortRegistry: economic.cohortRegistry,
      investmentCohortManager: economic.investmentCohortManager,
      revenueRouter: economic.revenueRouter,
      communityToken: economic.communityToken,
      treasuryAdapter: economic.treasuryAdapter,
    });
    console.log("[DeployWizard] Economic layer deployed", {
      cohortRegistry: economic.cohortRegistry,
      investmentCohortManager: economic.investmentCohortManager,
      revenueRouter: economic.revenueRouter,
      communityToken: economic.communityToken,
      treasuryAdapter: economic.treasuryAdapter,
    });
    }
  }

  let commerce:
    | {
      commerceDisputes: `0x${string}`;
      marketplace: `0x${string}`;
      housingManager: `0x${string}`;
      projectFactory: `0x${string}`;
    }
    | undefined;

  if (
    accessManagerFromPriorDeployProgress &&
    hasAddresses(runAddresses, ["commerceDisputes", "marketplace", "housingManager"])
  ) {
    commerce = {
      commerceDisputes: requireAddressArg(runAddresses.commerceDisputes, "run.commerceDisputes"),
      marketplace: requireAddressArg(runAddresses.marketplace, "run.marketplace"),
      housingManager: requireAddressArg(runAddresses.housingManager, "run.housingManager"),
      projectFactory: ZERO_ADDRESS as `0x${string}`,
    };
  } else {
    if (accessManagerFromPriorDeployProgress && wasAddressTouchedInPriorTx(factories.commerce)) {
      try {
        commerce = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.commerce,
          artifacts.commerceAbi,
          sender,
          normalizeCommerceDeployment
        );
        console.log("[DeployWizard] Recovered commerce layer from prior factory deployment mapping", {
          marketplace: commerce.marketplace,
        });
        publishAddresses({ marketplace: commerce.marketplace });
        publishAddresses({
          commerceDisputes: commerce.commerceDisputes,
          housingManager: commerce.housingManager,
        });
      } catch {
        // Fall through to normal deploy path.
      }
    }

    if (!commerce) {
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

    const fromEvent = decodeCommerceDeploymentFromReceipt(
      artifacts.commerceAbi,
      commerceDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
    );
    if (fromEvent) {
      commerce = fromEvent;
    } else {
      commerce = await readFactoryDeploymentWithRetry(
        publicClient,
        factories.commerce,
        artifacts.commerceAbi,
        sender,
        normalizeCommerceDeployment
      );
    }
    publishAddresses({
      commerceDisputes: commerce.commerceDisputes,
      marketplace: commerce.marketplace,
      housingManager: commerce.housingManager,
    });
    console.log("[DeployWizard] Commerce layer deployed", {
      commerceDisputes: commerce.commerceDisputes,
      marketplace: commerce.marketplace,
      housingManager: commerce.housingManager,
      projectFactory: commerce.projectFactory,
    });
    }
  }

  let coordination:
    | {
      requestHub: `0x${string}`;
      draftsManager: `0x${string}`;
    }
    | undefined;

  if (accessManagerFromPriorDeployProgress && hasAddresses(runAddresses, ["requestHub", "draftsManager"])) {
    coordination = {
      requestHub: requireAddressArg(runAddresses.requestHub, "run.requestHub"),
      draftsManager: requireAddressArg(runAddresses.draftsManager, "run.draftsManager"),
    };
  } else {
    if (accessManagerFromPriorDeployProgress && wasAddressTouchedInPriorTx(factories.coordination)) {
      try {
        coordination = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.coordination,
          artifacts.coordinationAbi,
          sender,
          normalizeCoordinationDeployment
        );
        console.log("[DeployWizard] Recovered coordination layer from prior factory deployment mapping", {
          requestHub: coordination.requestHub,
          draftsManager: coordination.draftsManager,
        });
        publishAddresses({
          requestHub: coordination.requestHub,
          draftsManager: coordination.draftsManager,
        });
      } catch {
        // Fall through to normal deploy path.
      }
    }

    if (!coordination) {
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

    const fromEvent = decodeCoordinationDeploymentFromReceipt(
      artifacts.coordinationAbi,
      coordinationDeployResult.receipt as { logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }> },
    );
    if (fromEvent) {
      coordination = fromEvent;
    } else {
      coordination = await readFactoryDeploymentWithRetry(
        publicClient,
        factories.coordination,
        artifacts.coordinationAbi,
        sender,
        normalizeCoordinationDeployment
      );
    }
    publishAddresses({
      requestHub: coordination.requestHub,
      draftsManager: coordination.draftsManager,
    });
    console.log("[DeployWizard] Coordination layer deployed", {
      requestHub: coordination.requestHub,
      draftsManager: coordination.draftsManager,
    });
    }
  }

  const deploymentAddresses: DeploymentRunAddresses = {
    communityRegistry: sharedInfra.communityRegistry,
    paramController: sharedInfra.paramController,
    accessManager,
    membershipToken: governance.membershipToken,
    governor: governance.governor,
    timelock: governance.timelock,
    requestHub: coordination.requestHub,
    draftsManager: coordination.draftsManager,
    engagements: verification.engagements,
    positionManager: verification.positionManager,
    credentialManager: verification.credentialManager,
    valuableActionRegistry: verification.valuableActionRegistry,
    verifierPowerToken: verification.verifierPowerToken,
    verifierElection: verification.verifierElection,
    verifierManager: verification.verifierManager,
    valuableActionSBT: verification.valuableActionSBT,
    cohortRegistry: economic.cohortRegistry,
    investmentCohortManager: economic.investmentCohortManager,
    treasuryAdapter: economic.treasuryAdapter,
    communityToken: economic.communityToken,
    revenueRouter: economic.revenueRouter,
    commerceDisputes: commerce.commerceDisputes,
    marketplace: commerce.marketplace,
    housingManager: commerce.housingManager,
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

  const decodeCommunityIdFromReceipt = (receipt: { logs?: unknown }): number | null => {
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
          return Number(decoded.args.communityId as bigint);
        }
      } catch {
        // Ignore unrelated logs.
      }
    }
    return null;
  };

  // Resume idempotency: if bootstrapCommunity already succeeded in this step, do not submit it again.
  if (!session.communityId) {
    const configureStep = session.steps.find((step) => step.key === "CONFIGURE_ACCESS_PERMISSIONS");
    const priorHashes = configureStep?.txHashes ?? [];
    if (priorHashes.length > 0) {
      for (const hash of priorHashes) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash });
          const decodedCommunityId = decodeCommunityIdFromReceipt(receipt as { logs?: unknown });
          if (decodedCommunityId && decodedCommunityId > 0) {
            console.log("[DeployWizard] Recovered configure-step communityId from prior tx receipt", {
              hash,
              communityId: decodedCommunityId,
            });
            return { txHashes, communityId: decodedCommunityId };
          }
        } catch {
          // Ignore unavailable receipts and continue fallback recovery.
        }
      }

      const nextCommunityId = (await publicClient.readContract({
        address: sharedInfra.communityRegistry,
        abi: COMMUNITY_REGISTRY_ABI,
        functionName: "nextCommunityId",
      })) as bigint;
      if (nextCommunityId > 1n) {
        const recoveredCommunityId = Number(nextCommunityId - 1n);
        console.log("[DeployWizard] Recovered configure-step communityId from nextCommunityId fallback", {
          recoveredCommunityId,
          nextCommunityId: Number(nextCommunityId),
        });
        return { txHashes, communityId: recoveredCommunityId };
      }
    }
  }

  if (!runAddresses) {
    throw new Error("DEPLOY_STACK must complete before wiring. Missing run-scoped deployment addresses.");
  }

  let nextNonce: bigint | undefined;
  nextNonce = await initializeNonceCursor(publicClient, connectedAddress);
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  const treasuryVault = requireAddressArg(context.config.treasuryVault, "treasury vault");
  const modulePayload = {
    accessManager: runAddresses.accessManager,
    membershipToken: runAddresses.membershipToken ?? ZERO_ADDRESS,
    governor: runAddresses.governor,
    timelock: runAddresses.timelock,
    countingMultiChoice: runAddresses.countingMultiChoice ?? ZERO_ADDRESS,
    requestHub: runAddresses.requestHub,
    draftsManager: runAddresses.draftsManager,
    engagementsManager: runAddresses.engagements,
    valuableActionRegistry: runAddresses.valuableActionRegistry,
    verifierPowerToken: runAddresses.verifierPowerToken,
    verifierElection: runAddresses.verifierElection,
    verifierManager: runAddresses.verifierManager,
    valuableActionSBT: runAddresses.valuableActionSBT,
    positionManager: runAddresses.positionManager ?? ZERO_ADDRESS,
    credentialManager: runAddresses.credentialManager ?? ZERO_ADDRESS,
    cohortRegistry: runAddresses.cohortRegistry ?? ZERO_ADDRESS,
    investmentCohortManager: runAddresses.investmentCohortManager ?? ZERO_ADDRESS,
    revenueRouter: runAddresses.revenueRouter,
    treasuryVault,
    treasuryAdapter: runAddresses.treasuryAdapter,
    communityToken: runAddresses.communityToken,
    paramController: runAddresses.paramController,
    commerceDisputes: runAddresses.commerceDisputes ?? ZERO_ADDRESS,
    marketplace: runAddresses.marketplace,
    housingManager: runAddresses.housingManager ?? ZERO_ADDRESS,
    projectFactory: runAddresses.projectFactory ?? ZERO_ADDRESS,
  };

  const beforeNextId = (await publicClient.readContract({
    address: sharedInfra.communityRegistry,
    abi: COMMUNITY_REGISTRY_ABI,
    functionName: "nextCommunityId",
  })) as bigint;

  const decodeCommunityId = (receipt: { logs?: unknown }, fallbackBefore: bigint, fallbackAfter: bigint): number => {
    const communityIdFromEvent = decodeCommunityIdFromReceipt(receipt);
    if (communityIdFromEvent && communityIdFromEvent > 0) {
      return communityIdFromEvent;
    }
    const derivedCommunityId = fallbackAfter > 0n ? fallbackAfter - 1n : fallbackBefore;
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
  } catch (error) {
    console.warn("[DeployWizard] bootstrapCommunity failed; falling back to legacy register+setters path", {
      error,
      communityRegistry: sharedInfra.communityRegistry,
    });

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

async function executeConfigureAccessPermissions(
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
  const communityId = session.communityId;
  if (!communityId) {
    throw new Error("Cannot configure access permissions without a registered community ID.");
  }

  console.log("[DeployWizard] Configure step detail", {
    communityId,
    note: "bootstrapCommunity sets registry/policy/module wiring; bootstrapAccessAndRuntime applies access + runtime initialization in one coordinator transaction.",
  });

  const runAddresses = requireRunScopedAddresses(session);
  const hydratedRunAddresses = await (async () => {
    const sender = requireAddressArg(connectedAddress ?? session.deployerAddress, "deployment sender");
    const factories = resolveFactoryAddressesFromPreflight(context.preflight);
    const artifacts = await loadFactoryArtifacts();
    let nextAddresses: DeploymentRunAddresses = { ...runAddresses };

    const needsVerificationHydration = [
      nextAddresses.verifierPowerToken,
      nextAddresses.verifierElection,
      nextAddresses.verifierManager,
      nextAddresses.valuableActionRegistry,
      nextAddresses.valuableActionSBT,
      nextAddresses.engagements,
      nextAddresses.positionManager,
      nextAddresses.credentialManager,
    ].some((value) => !isNonZeroAddress(value));

    if (needsVerificationHydration) {
      try {
        const verification = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.verification,
          artifacts.verificationAbi,
          sender,
          normalizeVerificationDeployment
        );
        const patch: Partial<DeploymentRunAddresses> = {
          verifierPowerToken: verification.verifierPowerToken,
          verifierElection: verification.verifierElection,
          verifierManager: verification.verifierManager,
          valuableActionRegistry: verification.valuableActionRegistry,
          valuableActionSBT: verification.valuableActionSBT,
          engagements: verification.engagements,
          positionManager: verification.positionManager,
          credentialManager: verification.credentialManager,
        };
        nextAddresses = { ...nextAddresses, ...patch };
        context.onDeploymentAddresses?.(patch);
        console.log("[DeployWizard] Hydrated verification addresses for configure step", patch);
      } catch (error) {
        console.warn("[DeployWizard] Unable to hydrate verification addresses for configure step", {
          error: String(error),
        });
      }
    }

    const needsEconomicHydration = [
      nextAddresses.cohortRegistry,
      nextAddresses.investmentCohortManager,
      nextAddresses.revenueRouter,
      nextAddresses.communityToken,
      nextAddresses.treasuryAdapter,
    ].some((value) => !isNonZeroAddress(value));

    if (needsEconomicHydration) {
      try {
        const economic = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.economic,
          artifacts.economicAbi,
          sender,
          normalizeEconomicDeployment
        );
        const patch: Partial<DeploymentRunAddresses> = {
          cohortRegistry: economic.cohortRegistry,
          investmentCohortManager: economic.investmentCohortManager,
          revenueRouter: economic.revenueRouter,
          communityToken: economic.communityToken,
          treasuryAdapter: economic.treasuryAdapter,
        };
        nextAddresses = { ...nextAddresses, ...patch };
        context.onDeploymentAddresses?.(patch);
        console.log("[DeployWizard] Hydrated economic addresses for configure step", patch);
      } catch (error) {
        console.warn("[DeployWizard] Unable to hydrate economic addresses for configure step", {
          error: String(error),
        });
      }
    }

    const needsCommerceHydration = [
      nextAddresses.commerceDisputes,
      nextAddresses.marketplace,
      nextAddresses.housingManager,
    ].some((value) => !isNonZeroAddress(value));

    if (needsCommerceHydration) {
      try {
        const commerce = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.commerce,
          artifacts.commerceAbi,
          sender,
          normalizeCommerceDeployment
        );
        const patch: Partial<DeploymentRunAddresses> = {
          commerceDisputes: commerce.commerceDisputes,
          marketplace: commerce.marketplace,
          housingManager: commerce.housingManager,
        };
        nextAddresses = { ...nextAddresses, ...patch };
        context.onDeploymentAddresses?.(patch);
        console.log("[DeployWizard] Hydrated commerce addresses for configure step", patch);
      } catch (error) {
        console.warn("[DeployWizard] Unable to hydrate commerce addresses for configure step", {
          error: String(error),
        });
      }
    }

    const needsGovernanceHydration = [
      nextAddresses.membershipToken,
      nextAddresses.governor,
      nextAddresses.timelock,
    ].some((value) => !isNonZeroAddress(value));

    if (needsGovernanceHydration) {
      try {
        const governance = await readFactoryDeploymentWithRetry(
          publicClient,
          factories.governance,
          artifacts.governanceAbi,
          sender,
          normalizeGovernanceDeployment
        );
        const patch: Partial<DeploymentRunAddresses> = {
          membershipToken: governance.membershipToken,
          governor: governance.governor,
          timelock: governance.timelock,
        };
        nextAddresses = { ...nextAddresses, ...patch };
        context.onDeploymentAddresses?.(patch);
        console.log("[DeployWizard] Hydrated governance addresses for configure step", patch);
      } catch (error) {
        console.warn("[DeployWizard] Unable to hydrate governance addresses for configure step", {
          error: String(error),
        });
      }
    }

    return nextAddresses;
  })();
  const requestHub = hydratedRunAddresses.requestHub;
  const positionManager = requireAddressArg(hydratedRunAddresses.positionManager, "run.positionManager");
  const verifierManager = hydratedRunAddresses.verifierManager;
  const engagements = hydratedRunAddresses.engagements;
  const credentialManager = requireAddressArg(hydratedRunAddresses.credentialManager, "run.credentialManager");
  const cohortRegistry = requireAddressArg(hydratedRunAddresses.cohortRegistry, "run.cohortRegistry");
  const investmentCohortManager = requireAddressArg(hydratedRunAddresses.investmentCohortManager, "run.investmentCohortManager");
  const valuableActionRegistry = hydratedRunAddresses.valuableActionRegistry;
  const verifierPowerToken = hydratedRunAddresses.verifierPowerToken;
  const verifierElection = hydratedRunAddresses.verifierElection;
  const valuableActionSBT = hydratedRunAddresses.valuableActionSBT;
  const treasuryAdapter = hydratedRunAddresses.treasuryAdapter;
  const communityToken = hydratedRunAddresses.communityToken;
  const revenueRouter = hydratedRunAddresses.revenueRouter;
  const membershipToken = requireAddressArg(hydratedRunAddresses.membershipToken, "run.membershipToken");
  const commerceDisputes = requireAddressArg(hydratedRunAddresses.commerceDisputes, "run.commerceDisputes");
  const marketplace = hydratedRunAddresses.marketplace;
  const housingManager = requireAddressArg(hydratedRunAddresses.housingManager, "run.housingManager");
  const timelock = hydratedRunAddresses.timelock;

  const founder = connectedAddress ?? session.deployerAddress;
  const accessManager = hydratedRunAddresses.accessManager;

  try {
    const registryAuthority = await publicClient.readContract({
      address: valuableActionRegistry,
      abi: ACCESS_MANAGED_AUTHORITY_ABI,
      functionName: "authority"
    });
    const marketplaceAuthority = await publicClient.readContract({
      address: marketplace,
      abi: ACCESS_MANAGED_AUTHORITY_ABI,
      functionName: "authority"
    });
    console.log("[DeployWizard] Configure authority check", {
      valuableActionRegistry,
      marketplace,
      runAccessManager: accessManager,
      valuableActionRegistryAuthority:
        typeof registryAuthority === "string" ? registryAuthority : String(registryAuthority),
      marketplaceAuthority:
        typeof marketplaceAuthority === "string" ? marketplaceAuthority : String(marketplaceAuthority),
    });
    if (isNonZeroAddress(registryAuthority) && registryAuthority.toLowerCase() !== accessManager.toLowerCase()) {
      throw new Error(
        `AccessManager mismatch detected in configure step. Wizard run address (${accessManager}) must match module authority (${registryAuthority}) on ValuableActionRegistry (${valuableActionRegistry}). Resume from DEPLOY_STACK with the same session to keep a single AccessManager reference.`
      );
    }
    if (isNonZeroAddress(marketplaceAuthority) && marketplaceAuthority.toLowerCase() !== accessManager.toLowerCase()) {
      throw new Error(
        `AccessManager mismatch detected in configure step. Wizard run address (${accessManager}) must match module authority (${marketplaceAuthority}) on Marketplace (${marketplace}). Resume from DEPLOY_STACK with the same session to keep a single AccessManager reference.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("AccessManager mismatch detected in configure step")) {
      throw error;
    }
    console.warn("[DeployWizard] Unable to resolve module authority; using run-scoped accessManager", {
      accessManager,
      valuableActionRegistry,
      error: String(error),
    });
  }

  let nextNonce: bigint | undefined;
  nextNonce = await initializeNonceCursor(publicClient, connectedAddress);
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  const executeRestrictedWrite = async (action: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }) => {
    await writeAndConfirm(
      writeContractAsync,
      publicClient,
      txHashes,
      action,
      connectedAddress,
      consumeNonce(),
      context.onTxConfirmed,
    );
  };

  const adminRole = await readAccessManagerAdminRoleWithRetry(publicClient, accessManager).catch(() => {
    throw new Error(
      `Invalid AccessManager at ${accessManager}. The stored run address is stale, unavailable on RPC, or not a ShiftAccessManager. Re-run DEPLOY_STACK to refresh addresses.`
    );
  });
  const walletHasAdminRole = connectedAddress
    ? (
        ((await publicClient.readContract({
          address: accessManager,
          abi: SHIFT_ACCESS_MANAGER_ABI,
          functionName: "hasRole",
          args: [adminRole, connectedAddress]
        })) as readonly [boolean, number])[0]
      )
    : false;
  if (!walletHasAdminRole) {
    throw new Error(
      "Connected wallet must hold AccessManager ADMIN_ROLE for strict staging wiring. Governance proposal fallback is disabled."
    );
  }

  const selectorRoleAssignments = [
    {
      target: valuableActionRegistry,
      role: adminRole,
      signatures: [
        "setValuableActionSBT(address)",
        "setIssuancePaused(bool)",
        "setIssuanceModule(address,bool)",
        "setCommunityNarrowing(bool)",
        "setCommunityIssuanceModule(address,bool)",
        "addFounder(address)",
        "proposeValuableAction((uint32,uint32,uint32,uint8,bytes32,uint32,uint8,bytes32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64),bytes32)",
        "activateFromGovernance(uint256,bytes32)",
        "update(uint256,(uint32,uint32,uint32,uint8,bytes32,uint32,uint8,bytes32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64))",
        "deactivate(uint256)"
      ]
    },
    {
      target: valuableActionRegistry,
      role: ROLES.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE,
      signatures: ["setModerator(address,bool)"]
    },
    {
      target: valuableActionRegistry,
      role: ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE,
      signatures: [
        "issueEngagement(address,uint8,bytes32,bytes)",
        "issuePosition(address,bytes32,uint32,bytes)",
        "issueInvestment(address,uint256,uint32,bytes)",
        "closePositionToken(uint256,uint8)",
        "issueRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)"
      ]
    },
    {
      target: engagements,
      role: adminRole,
      signatures: ["revoke(uint256)", "updateContracts(address,address)"]
    },
    {
      target: verifierElection,
      role: adminRole,
      signatures: [
        "setVerifierSet(address[],uint256[],string)",
        "banVerifiers(address[],string)",
        "unbanVerifier(address,string)",
        "adjustVerifierPower(address,uint256,string)"
      ]
    },
    {
      target: verifierManager,
      role: ROLES.VERIFIER_MANAGER_CALLER_ROLE,
      signatures: ["selectJurors(uint256,uint256,uint256,bool)", "reportFraud(uint256,address[],string)"]
    },
    {
      target: verifierPowerToken,
      role: adminRole,
      signatures: ["initializeCommunity(string)", "adminTransfer(address,address,uint256,string)", "setURI(string)"]
    },
    {
      target: verifierPowerToken,
      role: VPT_ELECTION_POWER_ROLE,
      signatures: [
        "mint(address,uint256,string)",
        "burn(address,uint256,string)",
        "batchMint(address[],uint256[],string)",
        "batchBurn(address[],uint256[],string)"
      ]
    },
    {
      target: revenueRouter,
      role: adminRole,
      signatures: [
        "setCommunityTreasury(address)",
        "setSupportedToken(address,bool)",
        "setParamController(address)",
        "setCohortRegistry(address)"
      ]
    },
    {
      target: revenueRouter,
      role: ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE,
      signatures: ["registerPosition(uint256)", "unregisterPosition(uint256)"]
    },
    {
      target: revenueRouter,
      role: ROLES.REVENUE_ROUTER_DISTRIBUTOR_ROLE,
      signatures: ["routeRevenue(address,uint256)"]
    },
    {
      target: positionManager,
      role: adminRole,
      signatures: [
        "setRevenueRouter(address)",
        "definePositionType(bytes32,uint32,bool)",
        "approveApplication(uint256,bytes)",
        "closePosition(uint256,uint8,bytes)"
      ]
    },
    {
      target: cohortRegistry,
      role: adminRole,
      signatures: ["createCohort(uint16,uint32,bytes32,uint64,uint64,bool)", "setCohortActive(uint256,bool)"]
    },
    {
      target: cohortRegistry,
      role: ROLES.COHORT_REVENUE_ROUTER_ROLE,
      signatures: ["markRecovered(uint256,uint256)"]
    },
    {
      target: cohortRegistry,
      role: ROLES.COHORT_INVESTMENT_RECORDER_ROLE,
      signatures: ["addInvestment(uint256,address,uint256,uint256)"]
    },
    {
      target: investmentCohortManager,
      role: adminRole,
      signatures: [
        "createCohort(uint16,uint32,bytes32,uint64,uint64,bool)",
        "setCohortActive(uint256,bool)",
        "issueInvestment(address,uint256,uint32,bytes)"
      ]
    },
    {
      target: credentialManager,
      role: adminRole,
      signatures: [
        "defineCourse(bytes32,address,bool)",
        "setCourseActive(bytes32,bool)",
        "revokeCredential(uint256,bytes32,bytes)"
      ]
    },
    {
      target: credentialManager,
      role: ROLES.CREDENTIAL_MANAGER_APPROVER_ROLE,
      signatures: ["approveApplication(uint256)"]
    },
    {
      target: treasuryAdapter,
      role: adminRole,
      signatures: [
        "setTokenAllowed(address,bool)",
        "setCapBps(address,uint16)",
        "setDestinationAllowed(address,bool)",
        "setVaultAdapterAllowed(address,bool)"
      ]
    },
    {
      target: marketplace,
      role: adminRole,
      signatures: [
        "setCommunityActive(bool)",
        "setCommunityToken(address)",
        "setCommerceDisputes(address)",
        "setRevenueRouter(address)"
      ]
    },
    {
      target: membershipToken,
      role: ROLES.MEMBERSHIP_TOKEN_MINTER_ROLE,
      signatures: ["mint(address,uint256,string)", "batchMint(address[],uint256[],string)"]
    },
    {
      target: membershipToken,
      role: ROLES.MEMBERSHIP_TOKEN_GOVERNANCE_ROLE,
      signatures: ["emergencyBurn(address,uint256)"]
    },
    {
      target: valuableActionSBT,
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      signatures: [
        "mintEngagement(address,uint8,bytes32,bytes)",
        "mintPosition(address,bytes32,uint32,bytes)",
        "mintRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)",
        "mintInvestment(address,uint256,uint32,bytes)",
        "setEndedAt(uint256,uint64)",
        "closePositionToken(uint256,uint8)",
        "updateTokenURI(uint256,string)"
      ]
    },
    {
      target: commerceDisputes,
      role: adminRole,
      signatures: [
        "setDisputeReceiver(address)",
        "finalizeDispute(uint256,uint8)",
        "cancelDispute(uint256)"
      ]
    },
    {
      target: commerceDisputes,
      role: ROLES.COMMERCE_DISPUTES_CALLER_ROLE,
      signatures: ["openDispute(uint8,uint256,address,address,uint256,string)"]
    },
    {
      target: housingManager,
      role: adminRole,
      signatures: ["createUnit(address,string,uint256,uint256,uint256)"]
    },
    {
      target: housingManager,
      role: ROLES.HOUSING_MARKETPLACE_CALLER_ROLE,
      signatures: ["consume(uint256,address,bytes,uint256)", "onOrderSettled(uint256,uint256,uint8)"]
    }
  ] as const;

  const roleGrants = [
    { role: VPT_ELECTION_POWER_ROLE, account: verifierElection as `0x${string}`, executionDelay: 0 },
    { role: ROLES.VERIFIER_MANAGER_CALLER_ROLE, account: engagements as `0x${string}`, executionDelay: 0 },
    {
      role: ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE,
      account: positionManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.COHORT_REVENUE_ROUTER_ROLE,
      account: revenueRouter as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.COHORT_INVESTMENT_RECORDER_ROLE,
      account: investmentCohortManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.REVENUE_ROUTER_DISTRIBUTOR_ROLE,
      account: marketplace as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.COMMERCE_DISPUTES_CALLER_ROLE,
      account: marketplace as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.HOUSING_MARKETPLACE_CALLER_ROLE,
      account: marketplace as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE,
      account: requestHub as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE,
      account: positionManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE,
      account: investmentCohortManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE,
      account: credentialManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE,
      account: timelock as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.MEMBERSHIP_TOKEN_MINTER_ROLE,
      account: engagements as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      account: valuableActionRegistry as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      account: engagements as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      account: positionManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      account: investmentCohortManager as `0x${string}`,
      executionDelay: 0
    },
    {
      role: ROLES.VALUABLE_ACTION_SBT_MANAGER_ROLE,
      account: credentialManager as `0x${string}`,
      executionDelay: 0
    }
  ] as const;

  const bootstrapCoordinator = resolveBootstrapCoordinatorAddress();
  if (!bootstrapCoordinator) {
    throw new Error(
      "Strict configure flow requires NEXT_PUBLIC_BOOTSTRAP_COORDINATOR. Refusing direct role-by-role fallback to preserve minimal transactions."
    );
  }

  console.log("[DeployWizard] BootstrapCoordinator detected for access wiring", {
    bootstrapCoordinator,
    accessManager,
  });

  const coordinatorCode = await publicClient.getBytecode({ address: bootstrapCoordinator });
  if (!coordinatorCode || coordinatorCode === "0x") {
    throw new Error(
      `BootstrapCoordinator has no bytecode at ${bootstrapCoordinator}. Refusing direct selector/role fallback.`
    );
  }

  const coordinatorHasAdminRole = ((await publicClient.readContract({
    address: accessManager,
    abi: SHIFT_ACCESS_MANAGER_ABI,
    functionName: "hasRole",
    args: [adminRole, bootstrapCoordinator]
  })) as readonly [boolean, number])[0];

  console.log("[DeployWizard] BootstrapCoordinator admin check", {
    bootstrapCoordinator,
    coordinatorHasAdminRole,
  });

  if (!coordinatorHasAdminRole) {
    throw new Error(
      `BootstrapCoordinator ${bootstrapCoordinator} is missing ADMIN_ROLE on AccessManager ${accessManager}. Re-run DEPLOY_STACK to grant coordinator admin and retry.`
    );
  }

  const tokens = parseAddresses(context.config.supportedTokensCsv);
  await executeRestrictedWrite({
    address: bootstrapCoordinator,
    abi: BOOTSTRAP_COORDINATOR_ABI,
    functionName: "bootstrapAccessAndRuntime",
    args: [
      accessManager,
      selectorRoleAssignments.map((assignment) => ({
        target: assignment.target,
        selectors: assignment.signatures.map((signature) => selector(signature)),
        role: Number(assignment.role)
      })),
      roleGrants.map((grant) => ({
        role: Number(grant.role),
        account: grant.account,
        executionDelay: grant.executionDelay
      })),
      {
        communityId: BigInt(communityId),
        valuableActionRegistry,
        verifierPowerToken,
        requestHub,
        founder,
        valuableActionSBT,
        revenueRouter,
        treasuryAdapter,
        marketplace,
        communityToken,
        treasuryVault: context.config.treasuryVault as `0x${string}`,
        supportedTokens: tokens,
        tokenCapBps: 1000,
        verifierMetadataURI: "ipfs://shift/vpt"
      }
    ]
  });

  return { txHashes };
}

async function executeHandoffAdminToTimelock(
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
  const communityId = session.communityId;
  if (!communityId) {
    throw new Error("Cannot handoff admin without a registered community ID.");
  }

  const runAddresses = requireRunScopedAddresses(session);
  const accessManager = runAddresses.accessManager;
  const timelock = runAddresses.timelock;
  const handoffFrom = connectedAddress ?? session.deployerAddress;

  try {
    const moduleAuthority = await publicClient.readContract({
      address: runAddresses.valuableActionRegistry,
      abi: ACCESS_MANAGED_AUTHORITY_ABI,
      functionName: "authority"
    });
    if (isNonZeroAddress(moduleAuthority) && moduleAuthority.toLowerCase() !== accessManager.toLowerCase()) {
      throw new Error(
        `AccessManager mismatch detected in handoff step. Wizard run address (${accessManager}) must match module authority (${moduleAuthority}) on ValuableActionRegistry (${runAddresses.valuableActionRegistry}). Resume from DEPLOY_STACK with the same session to keep a single AccessManager reference.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("AccessManager mismatch detected in handoff step")) {
      throw error;
    }
    console.warn("[DeployWizard] Unable to resolve module authority for handoff; using run-scoped accessManager", {
      accessManager,
      valuableActionRegistry: runAddresses.valuableActionRegistry,
      error: String(error),
    });
  }

  let nextNonce: bigint | undefined;
  nextNonce = await initializeNonceCursor(publicClient, connectedAddress);
  const consumeNonce = () => {
    if (typeof nextNonce !== "bigint") return undefined;
    const current = nextNonce;
    nextNonce += 1n;
    return current;
  };

  const adminRole = await readAccessManagerAdminRoleWithRetry(publicClient, accessManager).catch(() => {
    throw new Error(
      `Invalid AccessManager at ${accessManager}. The stored run address is stale, unavailable on RPC, or not a ShiftAccessManager. Re-run DEPLOY_STACK to refresh addresses.`
    );
  });

  const timelockHasAdmin = ((await publicClient.readContract({
    address: accessManager,
    abi: SHIFT_ACCESS_MANAGER_ABI,
    functionName: "hasRole",
    args: [adminRole, timelock]
  })) as readonly [boolean, number])[0];

  if (!timelockHasAdmin) {
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: accessManager,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "grantRole",
      args: [adminRole, timelock, 0]
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);
  }

  const bootstrapCoordinator = resolveBootstrapCoordinatorAddress();
  if (bootstrapCoordinator) {
    const coordinatorHasAdmin = ((await publicClient.readContract({
      address: accessManager,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "hasRole",
      args: [adminRole, bootstrapCoordinator]
    })) as readonly [boolean, number])[0];

    if (coordinatorHasAdmin) {
      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: accessManager,
        abi: SHIFT_ACCESS_MANAGER_ABI,
        functionName: "revokeRole",
        args: [adminRole, bootstrapCoordinator]
      }, connectedAddress, consumeNonce(), context.onTxConfirmed);
    }
  }

  const handoffFromHasAdmin = ((await publicClient.readContract({
    address: accessManager,
    abi: SHIFT_ACCESS_MANAGER_ABI,
    functionName: "hasRole",
    args: [adminRole, handoffFrom]
  })) as readonly [boolean, number])[0];

  if (handoffFromHasAdmin) {
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: accessManager,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "revokeRole",
      args: [adminRole, handoffFrom]
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);
  }

  const timelockAdminAfter = ((await publicClient.readContract({
    address: accessManager,
    abi: SHIFT_ACCESS_MANAGER_ABI,
    functionName: "hasRole",
    args: [adminRole, timelock]
  })) as readonly [boolean, number])[0];
  if (!timelockAdminAfter) {
    throw new Error("Admin handoff failed: timelock missing admin role after handoff.");
  }

  let handoffFromAdminAfter = await readHasRoleWithRetry(
    publicClient,
    accessManager,
    adminRole,
    handoffFrom,
    { retries: 4, delayMs: 1200 }
  );

  if (handoffFromAdminAfter) {
    // Some RPC backends can lag role-index updates; retry one more revoke before failing hard.
    await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
      address: accessManager,
      abi: SHIFT_ACCESS_MANAGER_ABI,
      functionName: "revokeRole",
      args: [adminRole, handoffFrom]
    }, connectedAddress, consumeNonce(), context.onTxConfirmed);

    handoffFromAdminAfter = await readHasRoleWithRetry(
      publicClient,
      accessManager,
      adminRole,
      handoffFrom,
      { retries: 4, delayMs: 1200 }
    );
  }

  if (handoffFromAdminAfter) {
    throw new Error("Admin handoff failed: deployer wallet still has admin role.");
  }

  return { txHashes };
}

export function createFactoryDeployStepExecutor(params: {
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  deployContractAsync?: DeployContractAsync;
  connectedAddress?: `0x${string}`;
}): StepExecutor {
  return async (step, session, context) => {
    assertStrictStagingMode(context.chainId);

    switch (step) {
      case "PRECHECKS":
      case "VERIFY_DEPLOYMENT":
        return { txHashes: [] };
      case "DEPLOY_STACK":
        return executeDeployStackWithFactories(params, session, context);
      case "CONFIGURE_ACCESS_PERMISSIONS": {
        const wiringResult = await registerAndWireCommunity(params, session, context);
        const syntheticSession: DeploymentWizardSession = {
          ...session,
          communityId: wiringResult.communityId,
        };
        const configureResult = await executeConfigureAccessPermissions(params, syntheticSession, context);
        return {
          txHashes: [...(wiringResult.txHashes ?? []), ...(configureResult.txHashes ?? [])],
          communityId: wiringResult.communityId,
          deploymentAddresses:
            configureResult.deploymentAddresses ?? syntheticSession.deploymentAddresses ?? session.deploymentAddresses,
        };
      }
      case "HANDOFF_ADMIN_TO_TIMELOCK":
        return executeHandoffAdminToTimelock(params, session, context);
      default:
        throw new Error(`Unknown deployment step: ${step}`);
    }
  };
}
