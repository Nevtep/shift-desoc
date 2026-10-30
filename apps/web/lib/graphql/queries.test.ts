import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CommunityOverviewDraftsQuery,
  CommunityOverviewProposalsQuery,
  CommunityOverviewRequestsQuery,
  EngagementQuery,
  EngagementsQuery
} from "./queries";

// `graphql` is a peer of graphql-request, not a direct dependency of the web package.
const graphqlJs: typeof import("graphql") = createRequire(require.resolve("graphql-request"))("graphql");
const indexerSchema = graphqlJs.buildSchema(
  readFileSync(path.resolve(__dirname, "../../../indexer/generated/schema.graphql"), "utf8")
);

describe("GraphQL query exports", () => {
  it("uses canonical engagements query names", () => {
    expect(EngagementsQuery).toContain("query Engagements");
    expect(EngagementQuery).toContain("query Engagement");
  });

  it("keeps engagement aliases mapped to current indexer entities", () => {
    expect(EngagementsQuery).toContain("engagements: engagementss(");
    expect(EngagementsQuery).toContain("participant");
    expect(EngagementsQuery).not.toMatch(/claim/i);
    expect(EngagementQuery).toContain("engagement: engagements(id: $id)");
    expect(EngagementQuery).toContain("jurorAssignmentss(");
    expect(EngagementQuery).not.toMatch(/claim/i);
  });

  it.each([
    ["EngagementsQuery", EngagementsQuery],
    ["EngagementQuery", EngagementQuery]
  ])("%s validates against the generated indexer schema", (_name, document) => {
    const errors = graphqlJs.validate(indexerSchema, graphqlJs.parse(document));
    expect(errors.map((e) => e.message)).toEqual([]);
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
