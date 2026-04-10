import { describe, expect, it, vi } from "vitest";

import { recoverProposalId } from "../../../../lib/governance/proposal-id-recovery";
import { buildBinaryIntent } from "../../components/governance/direct-proposal-create.fixtures";

describe("proposalId recovery order", () => {
  it("uses event decode before deterministic read fallback", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(999n)
    } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: {
        logs: [{
          address: "0x0000000000000000000000000000000000000200",
          topics: [
            "0x7d84a6267f48637d30fefb24e8f0d03e7f818f8f7581f5f96ddbcb969af370e8"
          ],
          data: "0x0000000000000000000000000000000000000000000000000000000000000123"
        }],
        status: "success"
      } as any,
      intent: buildBinaryIntent()
    });

    expect(result.source).toBe("event_log");
    expect(result.proposalId).toBe(291n);
    expect(publicClient.readContract).not.toHaveBeenCalled();
  });

  it("falls back to deterministic read when event parsing misses", async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(777n)
    } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: { logs: [], status: "success" } as any,
      intent: buildBinaryIntent()
    });

    expect(result.source).toBe("deterministic_read");
    expect(result.proposalId).toBe(777n);
  });

  it("returns unresolved fallback when event and deterministic read fail", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("RPC unavailable"))
    } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: { logs: [], status: "success" } as any,
      intent: buildBinaryIntent()
    });

    expect(result).toEqual({ proposalId: null, source: "unresolved" });
  });
});
