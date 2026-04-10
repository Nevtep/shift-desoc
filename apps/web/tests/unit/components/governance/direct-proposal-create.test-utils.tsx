import { vi } from "vitest";
import type { Address, PublicClient } from "viem";

import { buildBinaryIntent, DIRECT_PROPOSAL_FIXTURES } from "./direct-proposal-create.fixtures";

export function createMockPublicClient(overrides?: Partial<PublicClient>): PublicClient {
  const base = {
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: "success",
      logs: [],
      contractAddress: DIRECT_PROPOSAL_FIXTURES.governorAddress
    }),
    readContract: vi.fn().mockResolvedValue(111n)
  } as unknown as PublicClient;

  return Object.assign(base, overrides);
}

export function createMockSubmitDeps() {
  const writeContractAsync = vi.fn().mockResolvedValue(DIRECT_PROPOSAL_FIXTURES.txHash);
  const publicClient = createMockPublicClient();
  const submitLock = { current: false };
  const intent = buildBinaryIntent();

  return {
    intent,
    writeContractAsync,
    publicClient,
    submitLock,
    governorAbi: [],
    routeCommunityId: intent.communityId,
    resolvedGovernorAddress: intent.governorAddress as Address,
    connectedChainId: DIRECT_PROPOSAL_FIXTURES.chainId,
    expectedChainId: DIRECT_PROPOSAL_FIXTURES.chainId
  };
}
