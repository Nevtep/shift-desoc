import { describe, expect, it } from "vitest";

import {
  communityDraftDetailPath,
  communityDraftsPath,
  communityProposalDetailPath,
  communityProposalsPath
} from "../../../lib/governance/community-scoped-routes";

describe("community-scoped governance route helpers", () => {
  it("builds community-scoped proposal and draft paths", () => {
    expect(communityProposalsPath(7)).toBe("/communities/7/governance/proposals");
    expect(communityProposalDetailPath("7", "100")).toBe("/communities/7/governance/proposals/100");
    expect(communityDraftsPath(7)).toBe("/communities/7/coordination/drafts");
    expect(communityDraftDetailPath(7, "7:10")).toBe("/communities/7/coordination/drafts/7:10");
  });
});
