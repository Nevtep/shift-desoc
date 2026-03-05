import { describe, expect, it } from "vitest";

import {
  ClaimQuery,
  ClaimsQuery,
  EngagementQuery,
  EngagementsQuery
} from "./queries";

describe("GraphQL query exports", () => {
  it("uses canonical engagements query names", () => {
    expect(EngagementsQuery).toContain("query Engagements");
    expect(EngagementQuery).toContain("query Engagement");
  });

  it("preserves transitional aliases for claim-named imports", () => {
    expect(ClaimsQuery).toBe(EngagementsQuery);
    expect(ClaimQuery).toBe(EngagementQuery);
  });

  it("keeps engagement aliases mapped to current indexer entities", () => {
    expect(EngagementsQuery).toContain("engagements: claimss(");
    expect(EngagementQuery).toContain("engagement: claims(id: $id)");
  });
});
