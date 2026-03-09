import type { Abi, Address, PublicClient } from "viem";

import { getContractAddress } from "../contracts";
import type { FundingAssessment, PreflightAssessment, ProbeStatus, SharedInfraStatus } from "./types";

const ADMIN_ROLE_ABI = [
  {
    type: "function",
    name: "ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }]
  }
] as const satisfies Abi;

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
  address: Address,
  abi: Abi,
  functionName: string
): Promise<ProbeStatus> {
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
}

export async function probeSharedInfra(publicClient: PublicClient, chainId: number): Promise<SharedInfraStatus> {
  try {
    const accessManager = getContractAddress("accessManager", chainId);
    const paramController = getContractAddress("paramController", chainId);
    const communityRegistry = getContractAddress("communityRegistry", chainId);

    const [am, pc, cr] = await Promise.all([
      probe(publicClient, accessManager, ADMIN_ROLE_ABI, "ADMIN_ROLE"),
      probe(publicClient, paramController, PARAM_CONTROLLER_ABI, "communityRegistry"),
      probe(publicClient, communityRegistry, COMMUNITY_REGISTRY_ABI, "nextCommunityId")
    ]);

    const isUsable = am.hasCode && am.abiProbePassed && pc.hasCode && pc.abiProbePassed && cr.hasCode && cr.abiProbePassed;
    return {
      addressesPresent: true,
      accessManager: am,
      paramController: pc,
      communityRegistry: cr,
      isUsable
    };
  } catch {
    const unavailable: ProbeStatus = { hasCode: false, abiProbePassed: false, reason: "Address resolution failed" };
    return {
      addressesPresent: false,
      accessManager: unavailable,
      paramController: unavailable,
      communityRegistry: unavailable,
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

  if (!input.walletConnected) blockingReasons.push("Connect wallet to start deployment.");
  if (!supportedNetwork) blockingReasons.push("Switch to a supported network.");
  if (!input.sharedInfra.isUsable) blockingReasons.push("Shared infrastructure is missing or invalid.");
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
