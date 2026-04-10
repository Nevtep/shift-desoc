import type { Hash } from "viem";

import type { DirectProposalRoutingState } from "./direct-proposal-types";

export function buildDirectProposalRoutingState(params: {
  communityId: number;
  txHash: Hash;
  proposalId: bigint | null;
}): DirectProposalRoutingState {
  const { communityId, txHash, proposalId } = params;

  if (proposalId !== null) {
    return {
      destination: "proposal_detail",
      href: `/communities/${communityId}/governance/proposals/${proposalId.toString()}`,
      proposalId,
      txHash,
      indexLagHint: false,
      userMessage: "Proposal created successfully. Opening proposal detail."
    };
  }

  return {
    destination: "proposal_list_fallback",
    href: `/communities/${communityId}/governance/proposals?indexLag=1&txHash=${txHash}`,
    proposalId: null,
    txHash,
    indexLagHint: true,
    userMessage: "Proposal transaction confirmed. Indexer may be catching up, opening community proposal list."
  };
}
