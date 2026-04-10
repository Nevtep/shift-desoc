import { describe, expect, it } from "vitest";

import { buildDirectProposalRoutingState } from "../../../lib/governance/direct-proposal-routing";

describe("community governance proposal create routing", () => {
  it("routes to community-scoped detail when proposalId resolves", () => {
    const state = buildDirectProposalRoutingState({
      communityId: 7,
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      proposalId: 100n
    });

    expect(state.destination).toBe("proposal_detail");
    expect(state.href).toBe("/communities/7/governance/proposals/100");
  });

  it("routes to community-scoped list fallback with txHash context when unresolved", () => {
    const state = buildDirectProposalRoutingState({
      communityId: 7,
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      proposalId: null
    });

    expect(state.destination).toBe("proposal_list_fallback");
    expect(state.href).toContain("/communities/7/governance/proposals?");
    expect(state.href).toContain("txHash=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });
});
