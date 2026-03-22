import { keccak256, stringToBytes } from "viem";
import type { Abi, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import type { CommunityDeploymentConfig } from "./config";
import type {
  DeploymentRunAddresses,
  DeploymentWizardSession,
  PreflightAssessment,
  StepKey
} from "./types";

export type StepExecutionResult = {
  txHashes?: `0x${string}`[];
  communityId?: number;
  deploymentAddresses?: DeploymentRunAddresses;
};

export type StepExecutor = (
  step: StepKey,
  session: DeploymentWizardSession,
  context: {
    config: CommunityDeploymentConfig;
    chainId: number;
    preflight: PreflightAssessment;
    onTxConfirmed?: (txHash: `0x${string}`) => void;
    onDeploymentAddresses?: (addresses: Partial<DeploymentRunAddresses>) => void;
  }
) => Promise<StepExecutionResult>;

export type WriteContractAsync = (args: {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  gas?: bigint;
  nonce?: bigint;
}) => Promise<`0x${string}`>;

type WriteArgs = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

const COMMUNITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "nextCommunityId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "registerCommunity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "parentCommunityId", type: "uint256" }
    ],
    outputs: [{ name: "communityId", type: "uint256" }]
  },
  {
    type: "event",
    name: "CommunityRegistered",
    inputs: [
      { indexed: true, name: "communityId", type: "uint256" },
      { indexed: false, name: "name", type: "string" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "parentCommunityId", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "getCommunityModules",
    stateMutability: "view",
    inputs: [{ name: "communityId", type: "uint256" }],
    outputs: [
      {
        name: "",
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
          { name: "paramController", type: "address" }
        ]
      }
    ]
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
          { name: "paramController", type: "address" }
        ]
      }
    ],
    outputs: []
  }
] as const satisfies Abi;

const PARAM_CONTROLLER_ABI = [
  {
    type: "function",
    name: "setVerifierParams",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bool" },
      { type: "uint256" },
      { type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "setGovernanceParams",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "setEligibilityParams",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "setRevenuePolicy",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    outputs: []
  }
] as const satisfies Abi;

const ACCESS_MANAGER_ABI = [
  {
    type: "function",
    name: "ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }]
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [{ type: "uint64" }, { type: "address" }],
    outputs: [{ type: "bool" }, { type: "uint32" }]
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint64" }, { type: "address" }, { type: "uint32" }],
    outputs: []
  },
  {
    type: "function",
    name: "setTargetFunctionRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "bytes4[]" }, { type: "uint64" }],
    outputs: []
  },
  {
    type: "function",
    name: "getTargetFunctionRole",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "bytes4" }],
    outputs: [{ type: "uint64" }]
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint64" }, { type: "address" }],
    outputs: []
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
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "supportedTokens",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "setCommunityTreasury",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "setSupportedToken",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }, { type: "bool" }],
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
  }
] as const satisfies Abi;

const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "communityActive",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "communityTokens",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "setCommunityActive",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "bool" }],
    outputs: []
  },
  {
    type: "function",
    name: "setCommunityToken",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: []
  },
  {
    type: "function",
    name: "revenueRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  }
] as const satisfies Abi;

const ACCESS_MANAGED_AUTHORITY_ABI = [
  {
    type: "function",
    name: "authority",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  }
] as const satisfies Abi;

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
  }
] as const satisfies Abi;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ACCESS_MANAGED_UNAUTHORIZED_SELECTOR = "0x068ca9d8";
const VPT_ELECTION_POWER_ROLE = 1001n;
const ROLES = {
  VALUABLE_ACTION_REGISTRY_ISSUER_ROLE: 3n,
  REVENUE_ROUTER_DISTRIBUTOR_ROLE: 6n,
  REVENUE_ROUTER_POSITION_MANAGER_ROLE: 7n,
  COMMERCE_DISPUTES_CALLER_ROLE: 13n,
  HOUSING_MARKETPLACE_CALLER_ROLE: 14n
} as const;
const STRICT_STAGING_CHAIN_ID = 84532;
const BOOTSTRAP_COORDINATOR_ENV = "NEXT_PUBLIC_BOOTSTRAP_COORDINATOR";
const LEGACY_MODE_ENV_FLAGS = [
  "NEXT_PUBLIC_SHIFT_ENABLE_LEGACY_DEPLOY",
  "NEXT_PUBLIC_SHIFT_ENABLE_BACKFILL",
  "NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE"
] as const;

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
  grantRole: 250000n,
  revokeRole: 250000n
};

function resolveBootstrapCoordinatorAddress(chainId: number): `0x${string}` | undefined {
  void chainId;
  const fromEnv = process.env[BOOTSTRAP_COORDINATOR_ENV];
  if (typeof fromEnv === "string" && /^0x[a-fA-F0-9]{40}$/.test(fromEnv)) {
    return fromEnv as `0x${string}`;
  }

  return undefined;
}

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function assertStrictStagingMode(chainId: number): void {
  if (chainId !== STRICT_STAGING_CHAIN_ID) {
    throw new Error(
      `Strict staging mode only supports Base Sepolia (${STRICT_STAGING_CHAIN_ID}). Received chainId=${chainId}.`
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

function parseTokenCsv(csv: string): `0x${string}`[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as `0x${string}`[];
}

function selector(signature: string): `0x${string}` {
  return `0x${keccak256(stringToBytes(signature)).slice(2, 10)}` as `0x${string}`;
}

function requireProbeAddress(
  probe:
    | PreflightAssessment["sharedInfra"]["communityRegistry"]
    | PreflightAssessment["sharedInfra"]["paramController"]
    | PreflightAssessment["sharedInfra"]["accessManager"]
    | undefined,
  label: string
): `0x${string}` {
  if (!probe?.address) {
    throw new Error(`Missing ${label} address in preflight shared infra state.`);
  }
  return probe.address as `0x${string}`;
}

function resolveSharedInfraAddresses(preflight: PreflightAssessment): {
  communityRegistry: `0x${string}`;
  paramController: `0x${string}`;
  accessManager: `0x${string}`;
} {
  return {
    communityRegistry: requireProbeAddress(preflight.sharedInfra.communityRegistry, "communityRegistry"),
    paramController: requireProbeAddress(preflight.sharedInfra.paramController, "paramController"),
    accessManager: requireProbeAddress(preflight.sharedInfra.accessManager, "accessManager")
  };
}

function requireRunScopedAddresses(session: DeploymentWizardSession): DeploymentRunAddresses {
  if (!session.deploymentAddresses) {
    throw new Error(
      "Missing run-scoped deployment addresses. DEPLOY_STACK must complete and persist addresses before mutable steps."
    );
  }
  return session.deploymentAddresses;
}

async function resolveGasLimit(
  publicClient: PublicClient,
  args: WriteArgs,
  account?: `0x${string}`
): Promise<bigint> {
  try {
    const estimated = (await publicClient.estimateContractGas({
      ...args,
      account
    } as never)) as bigint;
    return (estimated * 12n) / 10n;
  } catch (error) {
    const rawError = String(error ?? "");
    if (
      rawError.includes(ACCESS_MANAGED_UNAUTHORIZED_SELECTOR) ||
      rawError.includes("AccessManagedUnauthorized")
    ) {
      throw new Error(
        `Unauthorized call for ${args.functionName}. Connected wallet lacks required AccessManager permission for this step.`
      );
    }

    const fallback = GAS_FALLBACK_BY_FUNCTION[args.functionName] ?? 700000n;
    console.log("[DeployWizard] Gas estimation failed, using fallback", {
      functionName: args.functionName,
      fallback,
      error
    });
    return fallback;
  }
}

async function writeAndConfirm(
  writeContractAsync: WriteContractAsync,
  publicClient: PublicClient,
  txHashes: `0x${string}`[],
  args: WriteArgs,
  account?: `0x${string}`,
  nonce?: bigint
) {
  const gas = await resolveGasLimit(publicClient, args, account);
  const hash = await writeContractAsync({ ...args, gas, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 300_000,
    retryCount: 24
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted for ${args.functionName} (${hash}).`);
  }
  txHashes.push(hash);
  return { hash, receipt };
}

export function createDefaultUserSignedStepExecutor(params: {
  publicClient: PublicClient;
  writeContractAsync: WriteContractAsync;
  connectedAddress?: `0x${string}`;
}): StepExecutor {
  const { publicClient, writeContractAsync, connectedAddress } = params;

  return async (step, session, context) => {
    const txHashes: `0x${string}`[] = [];
    const chainId = context.chainId;
    assertStrictStagingMode(chainId);
    let nextNonce: bigint | undefined;

    if (connectedAddress) {
      const pendingNonce = await publicClient.getTransactionCount({
        address: connectedAddress,
        blockTag: "pending"
      });
      nextNonce = BigInt(pendingNonce);
    }

    const consumeNonce = () => {
      if (typeof nextNonce !== "bigint") return undefined;
      const current = nextNonce;
      nextNonce += 1n;
      return current;
    };

    if (step === "PRECHECKS" || step === "VERIFY_DEPLOYMENT") {
      return {};
    }

    const sharedInfra = resolveSharedInfraAddresses(context.preflight);
    const communityRegistry = sharedInfra.communityRegistry;
    const paramController = sharedInfra.paramController;

    if (step === "DEPLOY_STACK") {
      throw new Error(
        "Direct DEPLOY_STACK is disabled. Use the factory deployment flow (createFactoryDeployStepExecutor), which deploys and wires modules without templates."
      );
    }

    if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
      const communityId = session.communityId;
      if (!communityId) {
        throw new Error("Cannot configure access permissions without a registered community ID.");
      }

      const runAddresses = requireRunScopedAddresses(session);
      const requestHub = runAddresses.requestHub;
      const positionManager = runAddresses.positionManager;
      const valuableActionRegistry = runAddresses.valuableActionRegistry;
      const verifierPowerToken = runAddresses.verifierPowerToken;
      const verifierElection = runAddresses.verifierElection;
      const valuableActionSBT = runAddresses.valuableActionSBT;
      const treasuryAdapter = runAddresses.treasuryAdapter;
      const communityToken = runAddresses.communityToken;
      const revenueRouter = runAddresses.revenueRouter;
      const marketplace = runAddresses.marketplace;

      const founder = connectedAddress ?? session.deployerAddress;
      const accessManager = runAddresses.accessManager;
      const adminRole = (await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "ADMIN_ROLE"
      })) as bigint;
      const walletHasAdminRole = connectedAddress
        ? (
            ((await publicClient.readContract({
              address: accessManager,
              abi: ACCESS_MANAGER_ABI,
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

      const executeRestrictedWrite = async (action: WriteArgs) => {
        await writeAndConfirm(writeContractAsync, publicClient, txHashes, action, connectedAddress, consumeNonce());
      };

      const ensureSelectorRole = async (
        target: `0x${string}`,
        role: bigint,
        signatures: string[]
      ) => {
        let requiresUpdate = false;
        for (const signature of signatures) {
          try {
            const currentRole = await publicClient.readContract({
              address: accessManager,
              abi: ACCESS_MANAGER_ABI,
              functionName: "getTargetFunctionRole",
              args: [target, selector(signature)]
            });
            if (typeof currentRole === "bigint" && currentRole !== role) {
              requiresUpdate = true;
              break;
            }
          } catch {
            requiresUpdate = true;
            break;
          }
        }

        if (!requiresUpdate) return;

        await executeRestrictedWrite({
          address: accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "setTargetFunctionRole",
          args: [target, signatures.map((signature) => selector(signature)), role]
        });
      };

      const ensureRole = async (role: bigint, account: `0x${string}`) => {
        const hasRole = ((await publicClient.readContract({
          address: accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "hasRole",
          args: [role, account]
        })) as readonly [boolean, number])[0];

        if (!hasRole) {
          await executeRestrictedWrite({
            address: accessManager,
            abi: ACCESS_MANAGER_ABI,
            functionName: "grantRole",
            args: [role, account, 0]
          });
        }
      };

      const selectorRoleAssignments = [
        {
          target: valuableActionRegistry,
          role: adminRole,
          signatures: [
            "setValuableActionSBT(address)",
            "setIssuanceModule(address,bool)",
            "addFounder(address)",
            "addFounder(address,uint256)"
          ]
        },
        {
          target: verifierPowerToken,
          role: adminRole,
          signatures: ["initializeCommunity(string)", "initializeCommunity(uint256,string)", "setURI(string)"]
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
          signatures: ["setCommunityTreasury(uint256,address)", "setSupportedToken(uint256,address,bool)"]
        },
        {
          target: treasuryAdapter,
          role: adminRole,
          signatures: [
            "setTokenAllowed(address,bool)",
            "setTokenAllowed(uint256,address,bool)",
            "setCapBps(address,uint16)",
            "setCapBps(uint256,address,uint16)",
            "setDestinationAllowed(address,bool)",
            "setDestinationAllowed(uint256,address,bool)"
          ]
        },
        {
          target: marketplace,
          role: adminRole,
          signatures: ["setCommunityActive(uint256,bool)", "setCommunityToken(uint256,address)"]
        }
      ] as const;

      const roleGrants = [
        { role: VPT_ELECTION_POWER_ROLE, account: verifierElection as `0x${string}`, executionDelay: 0 },
        ...(positionManager
          ? [
              {
                role: ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE,
                account: positionManager as `0x${string}`,
                executionDelay: 0
              }
            ]
          : []),
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
        }
      ] as const;

      let coordinatorWiringApplied = false;
      const bootstrapCoordinator = resolveBootstrapCoordinatorAddress(chainId);
      if (bootstrapCoordinator) {
        const coordinatorCode = await publicClient.getBytecode({ address: bootstrapCoordinator });
        if (coordinatorCode && coordinatorCode !== "0x") {
          const coordinatorHasAdminRole = ((await publicClient.readContract({
            address: accessManager,
            abi: ACCESS_MANAGER_ABI,
            functionName: "hasRole",
            args: [adminRole, bootstrapCoordinator]
          })) as readonly [boolean, number])[0];

          if (coordinatorHasAdminRole) {
            try {
              await executeRestrictedWrite({
                address: bootstrapCoordinator,
                abi: BOOTSTRAP_COORDINATOR_ABI,
                functionName: "configureAccessManager",
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
                  }))
                ]
              });
              coordinatorWiringApplied = true;
            } catch (error) {
              console.warn("[DeployWizard] BootstrapCoordinator wiring failed, falling back to direct writes", {
                error,
                bootstrapCoordinator,
                accessManager
              });
            }
          }
        }
      }

      if (!coordinatorWiringApplied) {
        // Mirror the minimum role and selector wiring expected by deploy scripts so wizard runs are self-contained.
        await ensureSelectorRole(valuableActionRegistry, adminRole, [
          "setValuableActionSBT(address)",
          "setIssuanceModule(address,bool)",
          "addFounder(address)",
          "addFounder(address,uint256)"
        ]);

        await ensureSelectorRole(verifierPowerToken, adminRole, [
          "initializeCommunity(string)",
          "initializeCommunity(uint256,string)",
          "setURI(string)"
        ]);

        await ensureSelectorRole(verifierPowerToken, VPT_ELECTION_POWER_ROLE, [
          "mint(address,uint256,string)",
          "burn(address,uint256,string)",
          "batchMint(address[],uint256[],string)",
          "batchBurn(address[],uint256[],string)"
        ]);

        await ensureSelectorRole(revenueRouter, adminRole, [
          "setCommunityTreasury(uint256,address)",
          "setSupportedToken(uint256,address,bool)"
        ]);

        await ensureSelectorRole(treasuryAdapter, adminRole, [
          "setTokenAllowed(address,bool)",
          "setTokenAllowed(uint256,address,bool)",
          "setCapBps(address,uint16)",
          "setCapBps(uint256,address,uint16)",
          "setDestinationAllowed(address,bool)",
          "setDestinationAllowed(uint256,address,bool)"
        ]);

        await ensureSelectorRole(marketplace, adminRole, [
          "setCommunityActive(uint256,bool)",
          "setCommunityToken(uint256,address)"
        ]);

        await ensureRole(VPT_ELECTION_POWER_ROLE, verifierElection);
        if (positionManager) {
          await ensureRole(ROLES.REVENUE_ROUTER_POSITION_MANAGER_ROLE, positionManager);
        }
        await ensureRole(ROLES.REVENUE_ROUTER_DISTRIBUTOR_ROLE, marketplace);
        await ensureRole(ROLES.COMMERCE_DISPUTES_CALLER_ROLE, marketplace);
        await ensureRole(ROLES.HOUSING_MARKETPLACE_CALLER_ROLE, marketplace);
        await ensureRole(ROLES.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, requestHub);
      }

      let vptInitialized = false;
      try {
        vptInitialized = (await publicClient.readContract({
          address: verifierPowerToken,
          abi: VERIFIER_POWER_TOKEN_ABI,
          functionName: "communityInitialized",
          args: []
        })) as boolean;
      } catch {
        vptInitialized = (await publicClient.readContract({
          address: verifierPowerToken,
          abi: VERIFIER_POWER_TOKEN_ABI,
          functionName: "communityInitialized",
          args: [BigInt(communityId)]
        })) as boolean;
      }

      if (!vptInitialized) {
        try {
          await executeRestrictedWrite({
            address: verifierPowerToken,
            abi: VERIFIER_POWER_TOKEN_ABI,
            functionName: "initializeCommunity",
            args: ["ipfs://shift/vpt"]
          });
        } catch {
          await executeRestrictedWrite({
            address: verifierPowerToken,
            abi: VERIFIER_POWER_TOKEN_ABI,
            functionName: "initializeCommunity",
            args: [BigInt(communityId), "ipfs://shift/vpt"]
          });
        }
      }

      const sbtAddress = (await publicClient.readContract({
        address: valuableActionRegistry,
        abi: VALUABLE_ACTION_REGISTRY_ABI,
        functionName: "valuableActionSBT"
      })) as `0x${string}`;

      if (sbtAddress.toLowerCase() !== valuableActionSBT.toLowerCase()) {
        await executeRestrictedWrite({
          address: valuableActionRegistry,
          abi: VALUABLE_ACTION_REGISTRY_ABI,
          functionName: "setValuableActionSBT",
          args: [valuableActionSBT]
        });
      }

      const requestHubAllowed = (await publicClient.readContract({
        address: valuableActionRegistry,
        abi: VALUABLE_ACTION_REGISTRY_ABI,
        functionName: "isIssuanceModule",
        args: [requestHub]
      })) as boolean;

      if (!requestHubAllowed) {
        await executeRestrictedWrite({
          address: valuableActionRegistry,
          abi: VALUABLE_ACTION_REGISTRY_ABI,
          functionName: "setIssuanceModule",
          args: [requestHub, true]
        });
      }

      const founderAllowed = (await publicClient.readContract({
        address: valuableActionRegistry,
        abi: VALUABLE_ACTION_REGISTRY_ABI,
        functionName: "founderWhitelist",
        args: [founder, BigInt(communityId)]
      })) as boolean;

      if (!founderAllowed) {
        try {
          await executeRestrictedWrite({
            address: valuableActionRegistry,
            abi: VALUABLE_ACTION_REGISTRY_ABI,
            functionName: "addFounder",
            args: [founder]
          });
        } catch {
          await executeRestrictedWrite({
            address: valuableActionRegistry,
            abi: VALUABLE_ACTION_REGISTRY_ABI,
            functionName: "addFounder",
            args: [founder, BigInt(communityId)]
          });
        }
      }

      const treasuryAddress = (await publicClient.readContract({
        address: revenueRouter,
        abi: REVENUE_ROUTER_ABI,
        functionName: "communityTreasuries",
        args: [BigInt(communityId)]
      })) as `0x${string}`;

      if (treasuryAddress.toLowerCase() !== context.config.treasuryVault.toLowerCase()) {
        await executeRestrictedWrite({
          address: revenueRouter,
          abi: REVENUE_ROUTER_ABI,
          functionName: "setCommunityTreasury",
          args: [BigInt(communityId), context.config.treasuryVault as `0x${string}`]
        });
      }

      const tokens = parseTokenCsv(context.config.supportedTokensCsv);
      for (const token of tokens) {
        const supportedInRouter = (await publicClient.readContract({
          address: revenueRouter,
          abi: REVENUE_ROUTER_ABI,
          functionName: "supportedTokens",
          args: [BigInt(communityId), token]
        })) as boolean;
        if (!supportedInRouter) {
          await executeRestrictedWrite({
            address: revenueRouter,
            abi: REVENUE_ROUTER_ABI,
            functionName: "setSupportedToken",
            args: [BigInt(communityId), token, true]
          });
        }

        let tokenAllowed = false;
        try {
          tokenAllowed = (await publicClient.readContract({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "tokenAllowed",
            args: [token]
          })) as boolean;
        } catch {
          tokenAllowed = (await publicClient.readContract({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "tokenAllowed",
            args: [BigInt(communityId), token]
          })) as boolean;
        }
        if (!tokenAllowed) {
          try {
            await executeRestrictedWrite({
              address: treasuryAdapter,
              abi: TREASURY_ADAPTER_ABI,
              functionName: "setTokenAllowed",
              args: [token, true]
            });
          } catch {
            await executeRestrictedWrite({
              address: treasuryAdapter,
              abi: TREASURY_ADAPTER_ABI,
              functionName: "setTokenAllowed",
              args: [BigInt(communityId), token, true]
            });
          }
        }

        let capBps: number | bigint = 0;
        try {
          capBps = (await publicClient.readContract({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "capBps",
            args: [token]
          })) as number;
        } catch {
          capBps = (await publicClient.readContract({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "capBps",
            args: [BigInt(communityId), token]
          })) as number;
        }
        if (Number(capBps) !== 1000) {
          try {
            await executeRestrictedWrite({
              address: treasuryAdapter,
              abi: TREASURY_ADAPTER_ABI,
              functionName: "setCapBps",
              args: [token, 1000]
            });
          } catch {
            await executeRestrictedWrite({
              address: treasuryAdapter,
              abi: TREASURY_ADAPTER_ABI,
              functionName: "setCapBps",
              args: [BigInt(communityId), token, 1000]
            });
          }
        }
      }

      let destinationAllowed = false;
      try {
        destinationAllowed = (await publicClient.readContract({
          address: treasuryAdapter,
          abi: TREASURY_ADAPTER_ABI,
          functionName: "destinationAllowed",
          args: [requestHub]
        })) as boolean;
      } catch {
        destinationAllowed = (await publicClient.readContract({
          address: treasuryAdapter,
          abi: TREASURY_ADAPTER_ABI,
          functionName: "destinationAllowed",
          args: [BigInt(communityId), requestHub]
        })) as boolean;
      }

      if (!destinationAllowed) {
        try {
          await executeRestrictedWrite({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "setDestinationAllowed",
            args: [requestHub, true]
          });
        } catch {
          await executeRestrictedWrite({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "setDestinationAllowed",
            args: [BigInt(communityId), requestHub, true]
          });
        }
      }

      const communityIsActive = (await publicClient.readContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "communityActive",
        args: [BigInt(communityId)]
      })) as boolean;
      if (!communityIsActive) {
        await executeRestrictedWrite({
          address: marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "setCommunityActive",
          args: [BigInt(communityId), true]
        });
      }

      const currentCommunityToken = (await publicClient.readContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "communityTokens",
        args: [BigInt(communityId)]
      })) as `0x${string}`;
      if (
        currentCommunityToken.toLowerCase() === ZERO_ADDRESS ||
        currentCommunityToken.toLowerCase() !== communityToken.toLowerCase()
      ) {
        await executeRestrictedWrite({
          address: marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "setCommunityToken",
          args: [BigInt(communityId), communityToken]
        });
      }

      return { txHashes };
    }

    if (step === "HANDOFF_ADMIN_TO_TIMELOCK") {
      const communityId = session.communityId;
      if (!communityId) {
        throw new Error("Cannot handoff admin without a registered community ID.");
      }

      const runAddresses = requireRunScopedAddresses(session);
      const accessManager = runAddresses.accessManager;
      const timelock = runAddresses.timelock;
      const handoffFrom = connectedAddress ?? session.deployerAddress;
      const adminRole = (await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "ADMIN_ROLE"
      })) as bigint;

      const timelockHasAdmin = ((await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [adminRole, timelock]
      })) as readonly [boolean, number])[0];

      if (!timelockHasAdmin) {
        await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
          address: accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "grantRole",
          args: [adminRole, timelock, 0]
        }, connectedAddress, consumeNonce());
      }

      const handoffFromHasAdmin = ((await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [adminRole, handoffFrom]
      })) as readonly [boolean, number])[0];

      if (handoffFromHasAdmin) {
        await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
          address: accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "revokeRole",
          args: [adminRole, handoffFrom]
        }, connectedAddress, consumeNonce());
      }

      const bootstrapCoordinator = resolveBootstrapCoordinatorAddress(chainId);
      if (bootstrapCoordinator) {
        const coordinatorHasAdmin = ((await publicClient.readContract({
          address: accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "hasRole",
          args: [adminRole, bootstrapCoordinator]
        })) as readonly [boolean, number])[0];

        if (coordinatorHasAdmin) {
          await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
            address: accessManager,
            abi: ACCESS_MANAGER_ABI,
            functionName: "revokeRole",
            args: [adminRole, bootstrapCoordinator]
          }, connectedAddress, consumeNonce());
        }
      }

      const timelockAdminAfter = ((await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [adminRole, timelock]
      })) as readonly [boolean, number])[0];
      if (!timelockAdminAfter) {
        throw new Error("Admin handoff failed: timelock missing admin role after handoff.");
      }

      const handoffFromAdminAfter = ((await publicClient.readContract({
        address: accessManager,
        abi: ACCESS_MANAGER_ABI,
        functionName: "hasRole",
        args: [adminRole, handoffFrom]
      })) as readonly [boolean, number])[0];
      if (handoffFromAdminAfter) {
        throw new Error("Admin handoff failed: deployer wallet still has admin role.");
      }

      return { txHashes };
    }

    return {};
  };
}
