import { describe, expect, it, vi } from "vitest";

import { submitDirectProposal } from "../../../lib/governance/direct-proposal-submit";
import { createMockSubmitDeps } from "../../unit/components/governance/direct-proposal-create.test-utils";

describe("direct proposal submit routing integration", () => {
  it("completes submit and returns detail routing when proposalId is recovered", async () => {
    const deps = createMockSubmitDeps();
    deps.publicClient.readContract = vi.fn().mockResolvedValue(100n);

    const result = await submitDirectProposal(deps as any);

    expect(result.creation.success).toBe(true);
    expect(result.routing.destination).toBe("proposal_detail");
    expect(result.routing.href).toBe("/communities/3/governance/proposals/100");
  });

  it("falls back to community-scoped list routing with txHash when unresolved", async () => {
    const deps = createMockSubmitDeps();
    deps.publicClient.readContract = vi.fn().mockRejectedValue(new Error("rpc down"));

    const result = await submitDirectProposal(deps as any);

    expect(result.routing.destination).toBe("proposal_list_fallback");
    expect(result.routing.href).toContain("/communities/3/governance/proposals?");
    expect(result.routing.href).toContain("txHash=");
  });
});
