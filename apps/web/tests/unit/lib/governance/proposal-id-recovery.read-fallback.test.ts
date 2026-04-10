import { describe, expect, it, vi } from "vitest";

import { recoverProposalId } from "../../../../lib/governance/proposal-id-recovery";
import { buildBinaryIntent } from "../../components/governance/direct-proposal-create.fixtures";

describe("proposalId recovery deterministic read fallback", () => {
  it("uses getProposalId/hashProposal when no matching event is present", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(55n)
    } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: { status: "success", logs: [] } as any,
      intent: buildBinaryIntent()
    });

    expect(result).toEqual({ proposalId: 55n, source: "deterministic_read" });
    expect(publicClient.readContract).toHaveBeenCalled();
  });
});
