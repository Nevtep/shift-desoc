import { describe, expect, it } from "vitest";

import { submitDirectProposal } from "../../../../lib/governance/direct-proposal-submit";
import { createMockSubmitDeps } from "./direct-proposal-create.test-utils";

describe("direct proposal submit multi-choice", () => {
  it("dispatches governor proposeMultiChoice(...) for multi-choice proposals", async () => {
    const deps = createMockSubmitDeps();
    deps.intent.mode = "multi_choice";
    deps.intent.numOptions = 3;

    await submitDirectProposal(deps as any);

    expect(deps.writeContractAsync).toHaveBeenCalledTimes(1);
    expect(deps.writeContractAsync.mock.calls[0][0].functionName).toBe("proposeMultiChoice");
    expect(deps.writeContractAsync.mock.calls[0][0].args[4]).toBe(3);
  });
});
