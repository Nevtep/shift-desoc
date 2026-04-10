import type { Address, Hex, Hash, PublicClient, TransactionReceipt } from "viem";

import type { PreparedAction } from "../../components/drafts/draft-create-form";

export type DirectProposalMode = "binary" | "multi_choice";

export type DirectProposalIntent = {
  communityId: number;
  governorAddress: Address;
  mode: DirectProposalMode;
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  description: string;
  numOptions?: number;
  actions: PreparedAction[];
};

export type DirectProposalGuardErrorType =
  | "invalid_community"
  | "governor_missing"
  | "context_mismatch"
  | "chain_mismatch"
  | "allowlist_violation";

export type DirectProposalGuardResult =
  | { ok: true }
  | { ok: false; errorType: DirectProposalGuardErrorType; message: string };

export type ProposalIdRecoverySource = "event_log" | "deterministic_read" | "unresolved";

export type ProposalIdRecoveryResult = {
  proposalId: bigint | null;
  source: ProposalIdRecoverySource;
};

export type ProposalCreationResult = {
  success: boolean;
  txHash: Hash;
  proposalId: bigint | null;
  recoverySource: ProposalIdRecoverySource;
  communityId: number;
  governorAddress: Address;
  confirmedAt: string;
};

export type DirectProposalRoutingState = {
  destination: "proposal_detail" | "proposal_list_fallback";
  href: string;
  proposalId: bigint | null;
  txHash: Hash;
  indexLagHint: boolean;
  userMessage: string;
};

export type DirectProposalSubmitErrorType =
  | "wallet_rejected"
  | "revert"
  | "context_mismatch"
  | "chain_mismatch"
  | "allowlist_violation"
  | "unknown";

export type DirectProposalSubmitError = {
  type: DirectProposalSubmitErrorType;
  message: string;
};

export type DirectProposalPreflightInput = {
  intent: DirectProposalIntent;
  routeCommunityId: number;
  resolvedGovernorAddress: Address | null | undefined;
  connectedChainId: number;
  expectedChainId: number;
};

export type DirectProposalRecoveryInput = {
  publicClient: PublicClient;
  governorAddress: Address;
  receipt: TransactionReceipt;
  intent: DirectProposalIntent;
};
