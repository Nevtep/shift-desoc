import { decodeEventLog, encodeFunctionData } from "viem";
import type { Abi, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import type { CommunityDeploymentConfig } from "./config";
import type { DeploymentWizardSession, PreflightAssessment, StepKey } from "./types";

export type StepExecutionResult = {
  txHashes?: `0x${string}`[];
  communityId?: number;
};

export type StepExecutor = (
  step: StepKey,
  session: DeploymentWizardSession,
  context: {
    config: CommunityDeploymentConfig;
    chainId: number;
    preflight: PreflightAssessment;
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

type GovernanceAction = WriteArgs;

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
  }
] as const satisfies Abi;

const GOVERNOR_ABI = [
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" }
    ],
    outputs: [{ type: "uint256" }]
  }
] as const satisfies Abi;

const VERIFIER_POWER_TOKEN_ABI = [
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
    inputs: [{ type: "uint256" }, { type: "address" }],
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
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint16" }]
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
    inputs: [{ type: "uint256" }, { type: "address" }, { type: "bool" }],
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
  }
] as const satisfies Abi;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ACCESS_MANAGED_UNAUTHORIZED_SELECTOR = "0x068ca9d8";

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
  propose: 1200000n
};

function parseTokenCsv(csv: string): `0x${string}`[] {
  return csv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as `0x${string}`[];
}

function encodeGovernanceAction(action: GovernanceAction): `0x${string}` {
  return encodeFunctionData({
    abi: action.abi,
    functionName: action.functionName,
    args: action.args
  });
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
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
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
    let nextNonce: bigint | undefined;

    if (connectedAddress) {
      const pendingNonce = await publicClient.getTransactionCount({
        address: connectedAddress,
        blockTag: "pending"
      });
      nextNonce = pendingNonce;
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

    const communityRegistry = getContractAddress("communityRegistry", chainId);
    const paramController = getContractAddress("paramController", chainId);
    const governor = getContractAddress("governor", chainId);
    const timelock = getContractAddress("timelock", chainId);
    const requestHub = getContractAddress("requestHub", chainId);
    const draftsManager = getContractAddress("draftsManager", chainId);
    const engagements = getContractAddress("engagements", chainId);
    const valuableActionRegistry = getContractAddress("valuableActionRegistry", chainId);
    const verifierPowerToken = getContractAddress("verifierPowerToken", chainId);
    const verifierElection = getContractAddress("verifierElection", chainId);
    const verifierManager = getContractAddress("verifierManager", chainId);
    const valuableActionSBT = getContractAddress("valuableActionSBT", chainId);
    const treasuryAdapter = getContractAddress("treasuryAdapter", chainId);
    const communityToken = getContractAddress("communityToken", chainId);
    const revenueRouter = getContractAddress("revenueRouter", chainId);
    const marketplace = getContractAddress("marketplace", chainId);

    if (step === "DEPLOY_STACK") {
      const beforeNextId = (await publicClient.readContract({
        address: communityRegistry,
        abi: COMMUNITY_REGISTRY_ABI,
        functionName: "nextCommunityId"
      })) as bigint;

      const registerResult = await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: communityRegistry,
        abi: COMMUNITY_REGISTRY_ABI,
        functionName: "registerCommunity",
        args: [
          context.config.communityName,
          context.config.communityDescription,
          context.config.communityMetadataUri,
          0n
        ]
      }, connectedAddress, consumeNonce());

      const afterNextId = (await publicClient.readContract({
        address: communityRegistry,
        abi: COMMUNITY_REGISTRY_ABI,
        functionName: "nextCommunityId"
      })) as bigint;

      let communityIdFromEvent: bigint | null = null;
      const registerLogs = Array.isArray((registerResult.receipt as { logs?: unknown }).logs)
        ? registerResult.receipt.logs
        : [];
      for (const rawLog of registerLogs) {
        try {
          const decoded = decodeEventLog({
            abi: COMMUNITY_REGISTRY_ABI,
            data: rawLog.data,
            topics: rawLog.topics
          });
          if (decoded.eventName === "CommunityRegistered") {
            communityIdFromEvent = decoded.args.communityId as bigint;
            break;
          }
        } catch {
          // Ignore unrelated logs
        }
      }

      const derivedCommunityId =
        communityIdFromEvent ??
        (afterNextId > 0n ? afterNextId - 1n : beforeNextId);
      const communityId = Number(derivedCommunityId);

      // Some staged deployments run older CommunityRegistry variants where helper read methods
      // differ; treat pre-authorization reads as best-effort and rely on the write call result.
      try {
        const modules = (await publicClient.readContract({
          address: communityRegistry,
          abi: COMMUNITY_REGISTRY_ABI,
          functionName: "getCommunityModules",
          args: [BigInt(communityId)]
        })) as { timelock?: `0x${string}` };

        if (
          modules.timelock &&
          modules.timelock.toLowerCase() !== ZERO_ADDRESS &&
          connectedAddress &&
          modules.timelock.toLowerCase() !== connectedAddress.toLowerCase()
        ) {
          console.log("[DeployWizard] Timelock differs from connected wallet; ParamController writes may revert", {
            communityId,
            timelock: modules.timelock,
            connectedAddress
          });
        }
      } catch (error) {
        console.log("[DeployWizard] Skipping CommunityRegistry auth precheck due to read incompatibility", {
          communityId,
          error
        });
      }

      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: paramController,
        abi: PARAM_CONTROLLER_ABI,
        functionName: "setVerifierParams",
        args: [BigInt(communityId), 5n, 3n, 20n, true, 1000n, 86400n]
      }, connectedAddress, consumeNonce());

      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: paramController,
        abi: PARAM_CONTROLLER_ABI,
        functionName: "setGovernanceParams",
        args: [BigInt(communityId), 7200n, 86400n, 21600n]
      }, connectedAddress, consumeNonce());

      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: paramController,
        abi: PARAM_CONTROLLER_ABI,
        functionName: "setEligibilityParams",
        args: [BigInt(communityId), 0n, 0n, 0n]
      }, connectedAddress, consumeNonce());

      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: paramController,
        abi: PARAM_CONTROLLER_ABI,
        functionName: "setRevenuePolicy",
        args: [BigInt(communityId), 1000n, 2000n, 1n, 5000n]
      }, connectedAddress, consumeNonce());

      await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
        address: communityRegistry,
        abi: COMMUNITY_REGISTRY_ABI,
        functionName: "setModuleAddresses",
        args: [
          BigInt(communityId),
          {
            governor,
            timelock,
            requestHub,
            draftsManager,
            engagementsManager: engagements,
            valuableActionRegistry,
            verifierPowerToken,
            verifierElection,
            verifierManager,
            valuableActionSBT,
            treasuryVault: context.config.treasuryVault as `0x${string}`,
            treasuryAdapter,
            communityToken,
            paramController
          }
        ]
      }, connectedAddress, consumeNonce());

      return { txHashes, communityId };
    }

    if (step === "WIRE_ROLES") {
      const communityId = session.communityId;
      if (!communityId) {
        throw new Error("Cannot wire roles without a registered community ID.");
      }

      const founder = connectedAddress ?? session.deployerAddress;
      const accessManager = getContractAddress("accessManager", chainId);
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
      const governanceActions: GovernanceAction[] = [];
      let forceGovernanceFallback = !walletHasAdminRole;

      const executeOrPropose = async (action: GovernanceAction) => {
        if (forceGovernanceFallback) {
          governanceActions.push(action);
          return;
        }
        try {
          await writeAndConfirm(writeContractAsync, publicClient, txHashes, action, connectedAddress, consumeNonce());
        } catch (error) {
          const message = String(error ?? "");
          const shouldFallbackToGovernance =
            action.functionName === "initializeCommunity" ||
            message.includes("AccessManagedUnauthorized") ||
            message.includes("Unauthorized call") ||
            message.includes("Transaction reverted for");

          if (!shouldFallbackToGovernance) {
            throw error;
          }

          forceGovernanceFallback = true;
          governanceActions.push(action);
          console.log("[DeployWizard] Direct restricted write reverted. Switching to governance proposal mode.", {
            functionName: action.functionName,
            address: action.address,
            reason: message
          });
        }
      };

      const vptInitialized = (await publicClient.readContract({
        address: verifierPowerToken,
        abi: VERIFIER_POWER_TOKEN_ABI,
        functionName: "communityInitialized",
        args: [BigInt(communityId)]
      })) as boolean;

      if (!vptInitialized) {
        await executeOrPropose({
          address: verifierPowerToken,
          abi: VERIFIER_POWER_TOKEN_ABI,
          functionName: "initializeCommunity",
          args: [BigInt(communityId), "ipfs://shift/vpt"]
        });
      }

      const sbtAddress = (await publicClient.readContract({
        address: valuableActionRegistry,
        abi: VALUABLE_ACTION_REGISTRY_ABI,
        functionName: "valuableActionSBT"
      })) as `0x${string}`;

      if (sbtAddress.toLowerCase() !== valuableActionSBT.toLowerCase()) {
        await executeOrPropose({
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
        await executeOrPropose({
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
        await executeOrPropose({
          address: valuableActionRegistry,
          abi: VALUABLE_ACTION_REGISTRY_ABI,
          functionName: "addFounder",
          args: [founder, BigInt(communityId)]
        });
      }

      const treasuryAddress = (await publicClient.readContract({
        address: revenueRouter,
        abi: REVENUE_ROUTER_ABI,
        functionName: "communityTreasuries",
        args: [BigInt(communityId)]
      })) as `0x${string}`;

      if (treasuryAddress.toLowerCase() !== context.config.treasuryVault.toLowerCase()) {
        await executeOrPropose({
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
          await executeOrPropose({
            address: revenueRouter,
            abi: REVENUE_ROUTER_ABI,
            functionName: "setSupportedToken",
            args: [BigInt(communityId), token, true]
          });
        }

        const tokenAllowed = (await publicClient.readContract({
          address: treasuryAdapter,
          abi: TREASURY_ADAPTER_ABI,
          functionName: "tokenAllowed",
          args: [BigInt(communityId), token]
        })) as boolean;
        if (!tokenAllowed) {
          await executeOrPropose({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "setTokenAllowed",
            args: [BigInt(communityId), token, true]
          });
        }

        const capBps = (await publicClient.readContract({
          address: treasuryAdapter,
          abi: TREASURY_ADAPTER_ABI,
          functionName: "capBps",
          args: [BigInt(communityId), token]
        })) as bigint;
        if (capBps !== 1000n) {
          await executeOrPropose({
            address: treasuryAdapter,
            abi: TREASURY_ADAPTER_ABI,
            functionName: "setCapBps",
            args: [BigInt(communityId), token, 1000]
          });
        }
      }

      const destinationAllowed = (await publicClient.readContract({
        address: treasuryAdapter,
        abi: TREASURY_ADAPTER_ABI,
        functionName: "destinationAllowed",
        args: [BigInt(communityId), requestHub]
      })) as boolean;

      if (!destinationAllowed) {
        await executeOrPropose({
          address: treasuryAdapter,
          abi: TREASURY_ADAPTER_ABI,
          functionName: "setDestinationAllowed",
          args: [BigInt(communityId), requestHub, true]
        });
      }

      const communityIsActive = (await publicClient.readContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "communityActive",
        args: [BigInt(communityId)]
      })) as boolean;
      if (!communityIsActive) {
        await executeOrPropose({
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
        await executeOrPropose({
          address: marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "setCommunityToken",
          args: [BigInt(communityId), communityToken]
        });
      }

      if (governanceActions.length > 0) {
        const targets = governanceActions.map((action) => action.address);
        const values = governanceActions.map(() => 0n);
        const calldatas = governanceActions.map((action) => encodeGovernanceAction(action));
        const description = `Wizard role/config wiring for community ${communityId} (${new Date().toISOString()})`;

        await writeAndConfirm(writeContractAsync, publicClient, txHashes, {
          address: governor,
          abi: GOVERNOR_ABI,
          functionName: "propose",
          args: [targets, values, calldatas, description]
        }, connectedAddress, consumeNonce());

        console.log("[DeployWizard] Governance proposal created for WIRE_ROLES.", {
          communityId,
          walletHasAdminRole,
          actions: governanceActions.length
        });
      }

      return { txHashes };
    }

    return {};
  };
}
