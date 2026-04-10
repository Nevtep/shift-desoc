import type { Address, Hash, PublicClient } from "viem";

import { buildDirectProposalRoutingState } from "./direct-proposal-routing";
import { validateDirectProposalPreflight } from "./direct-proposal-guards";
import { recoverProposalId } from "./proposal-id-recovery";
import type {
  DirectProposalGuardResult,
  DirectProposalIntent,
  DirectProposalRoutingState,
  ProposalCreationResult
} from "./direct-proposal-types";

type WriteContractAsync = (config: {
  address: Address;
  abi: readonly unknown[];
  functionName: "propose" | "proposeMultiChoice";
  args: readonly unknown[];
}) => Promise<Hash>;

export type DirectProposalSubmitInput = {
  intent: DirectProposalIntent;
  routeCommunityId: number;
  resolvedGovernorAddress: Address | null | undefined;
  connectedChainId: number;
  expectedChainId: number;
  governorAbi: readonly unknown[];
  writeContractAsync: WriteContractAsync;
  publicClient: PublicClient;
  submitLock: { current: boolean };
};

export type DirectProposalCreationResult = {
  creation: ProposalCreationResult;
  routing: DirectProposalRoutingState;
};

export function mapGuardErrorToSubmitError(guard: DirectProposalGuardResult): Error {
  if (guard.ok) return new Error("Unknown preflight failure.");
  return new Error(guard.message);
}

function buildWriteArgs(intent: DirectProposalIntent): {
  functionName: "propose" | "proposeMultiChoice";
  args: readonly unknown[];
} {
  if (intent.mode === "multi_choice") {
    return {
      functionName: "proposeMultiChoice",
      args: [intent.targets, intent.values, intent.calldatas, intent.description, Number(intent.numOptions ?? 2)]
    };
  }

  return {
    functionName: "propose",
    args: [intent.targets, intent.values, intent.calldatas, intent.description]
  };
}

export function classifySubmitError(error: unknown): {
  type: "wallet_rejected" | "revert" | "chain_mismatch" | "unknown";
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("user rejected") || lowered.includes("user denied") || lowered.includes("rejected")) {
    return { type: "wallet_rejected", message: "Wallet signature was rejected." };
  }
  if (lowered.includes("chain") && lowered.includes("mismatch") || lowered.includes("wrong network")) {
    return { type: "chain_mismatch", message: "Wrong network selected for this community." };
  }
  if (lowered.includes("revert") || lowered.includes("execution reverted")) {
    return { type: "revert", message: "Transaction reverted on-chain." };
  }

  return { type: "unknown", message };
}

export async function submitDirectProposal(input: DirectProposalSubmitInput): Promise<DirectProposalCreationResult> {
  if (input.submitLock.current) {
    throw new Error("A proposal submission is already in progress. Please wait for confirmation.");
  }

  const guard = validateDirectProposalPreflight({
    intent: input.intent,
    routeCommunityId: input.routeCommunityId,
    resolvedGovernorAddress: input.resolvedGovernorAddress,
    connectedChainId: input.connectedChainId,
    expectedChainId: input.expectedChainId
  });

  if (!guard.ok) {
    throw mapGuardErrorToSubmitError(guard);
  }

  input.submitLock.current = true;

  try {
    const writePayload = buildWriteArgs(input.intent);
    const txHash = await input.writeContractAsync({
      address: input.intent.governorAddress,
      abi: input.governorAbi,
      functionName: writePayload.functionName,
      args: writePayload.args
    });

    const receipt = await input.publicClient.waitForTransactionReceipt({ hash: txHash });

    const recovered = await recoverProposalId({
      publicClient: input.publicClient,
      governorAddress: input.intent.governorAddress,
      receipt,
      intent: input.intent
    });

    const creation: ProposalCreationResult = {
      success: receipt.status === "success",
      txHash,
      proposalId: recovered.proposalId,
      recoverySource: recovered.source,
      communityId: input.intent.communityId,
      governorAddress: input.intent.governorAddress,
      confirmedAt: new Date().toISOString()
    };

    const routing = buildDirectProposalRoutingState({
      communityId: input.intent.communityId,
      txHash,
      proposalId: recovered.proposalId
    });

    return { creation, routing };
  } finally {
    input.submitLock.current = false;
  }
}
