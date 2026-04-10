import { describe, expect, it } from "vitest";

import { submitDirectProposal } from "../../../../lib/governance/direct-proposal-submit";
import { createMockSubmitDeps } from "./direct-proposal-create.test-utils";

describe("direct proposal submit binary", () => {
  it("dispatches governor propose(...) for binary proposals", async () => {
    const deps = createMockSubmitDeps();

    await submitDirectProposal(deps as any);

    expect(deps.writeContractAsync).toHaveBeenCalledTimes(1);
    expect(deps.writeContractAsync.mock.calls[0][0].functionName).toBe("propose");
  });
});
