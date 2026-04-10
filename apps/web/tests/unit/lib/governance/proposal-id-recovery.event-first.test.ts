import { describe, expect, it, vi } from "vitest";

import { recoverProposalId } from "../../../../lib/governance/proposal-id-recovery";
import { buildBinaryIntent } from "../../components/governance/direct-proposal-create.fixtures";

describe("proposalId recovery event-first", () => {
  it("returns proposalId from governor event logs before chain reads", async () => {
    const publicClient = { readContract: vi.fn().mockResolvedValue(444n) } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: {
        status: "success",
        logs: [{
          address: "0x0000000000000000000000000000000000000200",
          topics: ["0x7d84a6267f48637d30fefb24e8f0d03e7f818f8f7581f5f96ddbcb969af370e8"],
          data: "0x000000000000000000000000000000000000000000000000000000000000002a"
        }]
      } as any,
      intent: buildBinaryIntent()
    });

    expect(result).toEqual({ proposalId: 42n, source: "event_log" });
    expect(publicClient.readContract).not.toHaveBeenCalled();
  });
});
