import { describe, expect, it } from "vitest";

import {
  CommunityOverviewDraftsQuery,
  CommunityOverviewProposalsQuery,
  CommunityOverviewRequestsQuery,
  EngagementQuery,
  EngagementsQuery
} from "./queries";

describe("GraphQL query exports", () => {
  it("uses canonical engagements query names", () => {
    expect(EngagementsQuery).toContain("query Engagements");
    expect(EngagementQuery).toContain("query Engagement");
  });

  it("keeps engagement aliases mapped to current indexer entities", () => {
    expect(EngagementsQuery).toContain("engagements: claimss(");
    expect(EngagementQuery).toContain("engagement: claims(id: $id)");
  });

  it("keeps overview preview queries strictly community scoped", () => {
    expect(CommunityOverviewRequestsQuery).toContain("$communityId: Int!");
    expect(CommunityOverviewDraftsQuery).toContain("$communityId: Int!");
    expect(CommunityOverviewProposalsQuery).toContain("$communityId: Int!");

    expect(CommunityOverviewRequestsQuery).toContain("where: { communityId: $communityId }");
    expect(CommunityOverviewDraftsQuery).toContain("where: { communityId: $communityId }");
    expect(CommunityOverviewProposalsQuery).toContain("where: { communityId: $communityId }");
  });

  it("uses latest-3 defaults for overview previews", () => {
    expect(CommunityOverviewRequestsQuery).toContain("$limit: Int = 3");
    expect(CommunityOverviewDraftsQuery).toContain("$limit: Int = 3");
    expect(CommunityOverviewProposalsQuery).toContain("$limit: Int = 3");
  });
});
