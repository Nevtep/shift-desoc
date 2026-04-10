import type { Address, Hash } from "viem";

import type { DirectProposalIntent } from "../../../../lib/governance/direct-proposal-types";

export const DIRECT_PROPOSAL_FIXTURES = {
  communityId: 3,
  chainId: 84532,
  governorAddress: "0x0000000000000000000000000000000000000200" as Address,
  txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hash,
  target: "0x0000000000000000000000000000000000000210" as Address
};

export function buildBinaryIntent(overrides: Partial<DirectProposalIntent> = {}): DirectProposalIntent {
  return {
    communityId: DIRECT_PROPOSAL_FIXTURES.communityId,
    governorAddress: DIRECT_PROPOSAL_FIXTURES.governorAddress,
    mode: "binary",
    targets: [DIRECT_PROPOSAL_FIXTURES.target],
    values: [0n],
    calldatas: ["0x1234"],
    description: "ipfs://proposal-desc",
    actions: [{
      targetId: "draftsManager",
      target: DIRECT_PROPOSAL_FIXTURES.target,
      value: 0n,
      calldata: "0x1234",
      targetLabel: "DraftsManager",
      functionSignature: "setEscalationPolicy(uint256,(bool,uint8,uint8,uint64))",
      argsPreview: ["draftId (uint256): 1", "policy (tuple): {...}"]
    }],
    ...overrides
  };
}

export function buildMultiChoiceIntent(overrides: Partial<DirectProposalIntent> = {}): DirectProposalIntent {
  return {
    ...buildBinaryIntent({ mode: "multi_choice", numOptions: 3 }),
    ...overrides
  };
}
