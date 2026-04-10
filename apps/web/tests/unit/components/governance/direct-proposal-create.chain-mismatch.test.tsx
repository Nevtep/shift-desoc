import { describe, expect, it } from "vitest";

import { submitDirectProposal } from "../../../../lib/governance/direct-proposal-submit";
import { createMockSubmitDeps } from "./direct-proposal-create.test-utils";

describe("direct proposal chain mismatch", () => {
  it("blocks chain mismatch before wallet prompt", async () => {
    const deps = createMockSubmitDeps();
    deps.connectedChainId = 1;

    await expect(submitDirectProposal(deps as any)).rejects.toThrow(/network/i);
    expect(deps.writeContractAsync).not.toHaveBeenCalled();
  });
});
