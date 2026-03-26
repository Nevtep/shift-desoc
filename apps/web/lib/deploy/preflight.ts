import type { Abi, Address, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import { getOrFetchPersistentCache } from "./persistent-cache";
import type { FundingAssessment, PreflightAssessment, ProbeStatus, SharedInfraStatus } from "./types";

const PARAM_CONTROLLER_ABI = [
  {
    type: "function",
    name: "communityRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const satisfies Abi;

const COMMUNITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "nextCommunityId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const satisfies Abi;

const PREFLIGHT_PROBE_TTL_MS = 45_000;

export type FundsEstimateInput = {
  estimatedTxCount: number;
  estimatedGasPerTx: bigint;
  maxFeePerGasWei: bigint;
  currentBalanceWei: bigint;
  bufferMultiplierBps?: number;
};

export function estimateFunding(input: FundsEstimateInput): FundingAssessment {
  const bufferMultiplierBps = input.bufferMultiplierBps ?? 12500;
  const baseRequiredWei = BigInt(input.estimatedTxCount) * input.estimatedGasPerTx * input.maxFeePerGasWei;
  const requiredWei = (baseRequiredWei * BigInt(bufferMultiplierBps)) / 10_000n;
  const isSufficient = input.currentBalanceWei >= requiredWei;
  return {
    requiredWei,
    currentBalanceWei: input.currentBalanceWei,
    bufferMultiplierBps,
    estimatedTxCount: input.estimatedTxCount,
    estimatedGasPerTx: input.estimatedGasPerTx,
    maxFeePerGasWei: input.maxFeePerGasWei,
    isSufficient,
    recommendedAdditionalWei: isSufficient ? undefined : requiredWei - input.currentBalanceWei
  };
}

async function probe(
  publicClient: PublicClient,
  chainId: number,
  address: Address,
  abi: Abi,
  functionName: string
): Promise<ProbeStatus> {
  const cacheKey = `preflight:probe:${chainId}:${address.toLowerCase()}:${functionName}`;
  return getOrFetchPersistentCache(cacheKey, PREFLIGHT_PROBE_TTL_MS, async () => {
    const code = await publicClient.getBytecode({ address });
    if (!code || code === "0x") {
      return { address, hasCode: false, abiProbePassed: false, reason: "Missing bytecode" };
    }

    try {
      await publicClient.readContract({
        address,
        abi,
        functionName,
        args: []
      });
      return { address, hasCode: true, abiProbePassed: true };
    } catch {
      return { address, hasCode: true, abiProbePassed: false, reason: `ABI probe failed: ${functionName}` };
    }
  });
}

async function probeCodeOnly(publicClient: PublicClient, chainId: number, address: Address): Promise<ProbeStatus> {
  const cacheKey = `preflight:code:${chainId}:${address.toLowerCase()}`;
  return getOrFetchPersistentCache(cacheKey, PREFLIGHT_PROBE_TTL_MS, async () => {
    const code = await publicClient.getBytecode({ address });
    if (!code || code === "0x") {
      return { address, hasCode: false, abiProbePassed: false, reason: "Missing bytecode" };
    }
    return { address, hasCode: true, abiProbePassed: true };
  });
}

export async function probeSharedInfra(publicClient: PublicClient, chainId: number): Promise<SharedInfraStatus> {
  try {
    const resolveOptionalAddress = (key: string): Address | undefined => {
      try {
        return getContractAddress(key as never, chainId);
      } catch {
        return undefined;
      }
    };

    const paramController = getContractAddress("paramController", chainId);
    const communityRegistry = getContractAddress("communityRegistry", chainId);
    const governanceLayerFactory = resolveOptionalAddress("governanceLayerFactory");
    const verificationLayerFactory = resolveOptionalAddress("verificationLayerFactory");
    const economicLayerFactory = resolveOptionalAddress("economicLayerFactory");
    const commerceLayerFactory = resolveOptionalAddress("commerceLayerFactory");
    const coordinationLayerFactory = resolveOptionalAddress("coordinationLayerFactory");

    const probeFactory = async (address: Address | undefined): Promise<ProbeStatus> => {
      if (!address) {
        return { hasCode: false, abiProbePassed: false, reason: "Address resolution failed" };
      }
      return probeCodeOnly(publicClient, chainId, address);
    };

    const [pc, cr, govFactory, verFactory, ecoFactory, comFactory, coordFactory] = await Promise.all([
      probe(publicClient, chainId, paramController, PARAM_CONTROLLER_ABI, "communityRegistry"),
      probe(publicClient, chainId, communityRegistry, COMMUNITY_REGISTRY_ABI, "nextCommunityId"),
      probeFactory(governanceLayerFactory),
      probeFactory(verificationLayerFactory),
      probeFactory(economicLayerFactory),
      probeFactory(commerceLayerFactory),
      probeFactory(coordinationLayerFactory)
    ]);

    const isUsable = pc.hasCode && pc.abiProbePassed && cr.hasCode && cr.abiProbePassed;
    return {
      addressesPresent: true,
      paramController: pc,
      communityRegistry: cr,
      governanceLayerFactory: govFactory,
      verificationLayerFactory: verFactory,
      economicLayerFactory: ecoFactory,
      commerceLayerFactory: comFactory,
      coordinationLayerFactory: coordFactory,
      isUsable
    };
  } catch {
    const unavailable: ProbeStatus = { hasCode: false, abiProbePassed: false, reason: "Address resolution failed" };
    return {
      addressesPresent: false,
      paramController: unavailable,
      communityRegistry: unavailable,
      governanceLayerFactory: unavailable,
      verificationLayerFactory: unavailable,
      economicLayerFactory: unavailable,
      commerceLayerFactory: unavailable,
      coordinationLayerFactory: unavailable,
      isUsable: false
    };
  }
}

export type BuildPreflightInput = {
  walletConnected: boolean;
  connectedAddress?: `0x${string}`;
  chainId: number;
  supportedChainIds: number[];
  sharedInfra: SharedInfraStatus;
  funding: FundingAssessment;
};

export function buildPreflightAssessment(input: BuildPreflightInput): PreflightAssessment {
  const supportedNetwork = input.supportedChainIds.includes(input.chainId);
  const blockingReasons: string[] = [];
  const missingRequiredFactory =
    !input.sharedInfra.governanceLayerFactory.hasCode ||
    !input.sharedInfra.verificationLayerFactory.hasCode ||
    !input.sharedInfra.economicLayerFactory.hasCode ||
    !input.sharedInfra.commerceLayerFactory.hasCode ||
    !input.sharedInfra.coordinationLayerFactory.hasCode;

  if (!input.walletConnected) blockingReasons.push("Connect wallet to start deployment.");
  if (!supportedNetwork) blockingReasons.push("Switch to a supported network.");
  if (supportedNetwork && !input.sharedInfra.isUsable) {
    blockingReasons.push("Shared infrastructure is missing or invalid.");
  }
  if (supportedNetwork && input.sharedInfra.isUsable && missingRequiredFactory) {
    blockingReasons.push("One or more layer factory addresses are missing or invalid.");
  }
  if (!input.funding.isSufficient) blockingReasons.push("Insufficient native token balance for estimated deployment cost.");

  return {
    walletConnected: input.walletConnected,
    connectedAddress: input.connectedAddress,
    supportedNetwork,
    chainId: input.chainId,
    sharedInfra: input.sharedInfra,
    funding: input.funding,
    blockingReasons
  };
}
