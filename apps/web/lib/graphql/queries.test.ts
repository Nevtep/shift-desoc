import { describe, expect, it } from "vitest";

import {
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
});
