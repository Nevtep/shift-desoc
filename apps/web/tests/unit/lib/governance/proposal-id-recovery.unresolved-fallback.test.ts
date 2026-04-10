import { describe, expect, it, vi } from "vitest";

import { recoverProposalId } from "../../../../lib/governance/proposal-id-recovery";
import { buildBinaryIntent } from "../../components/governance/direct-proposal-create.fixtures";

describe("proposalId recovery unresolved fallback", () => {
  it("returns unresolved when no event and deterministic read fails", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("offline"))
    } as any;

    const result = await recoverProposalId({
      publicClient,
      governorAddress: "0x0000000000000000000000000000000000000200",
      receipt: { status: "success", logs: [] } as any,
      intent: buildBinaryIntent()
    });

    expect(result).toEqual({ proposalId: null, source: "unresolved" });
  });
});
