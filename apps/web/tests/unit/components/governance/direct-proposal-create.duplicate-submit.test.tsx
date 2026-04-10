import { describe, expect, it } from "vitest";

import { submitDirectProposal } from "../../../../lib/governance/direct-proposal-submit";
import { createMockSubmitDeps } from "./direct-proposal-create.test-utils";

describe("direct proposal duplicate submit lock", () => {
  it("prevents duplicate submissions while lock is active", async () => {
    const deps = createMockSubmitDeps();
    deps.submitLock.current = true;

    await expect(submitDirectProposal(deps as any)).rejects.toThrow(/already in progress/i);
    expect(deps.writeContractAsync).not.toHaveBeenCalled();
  });
});
