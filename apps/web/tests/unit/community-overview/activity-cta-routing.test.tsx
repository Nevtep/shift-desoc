import { describe, expect, it } from "vitest";

import { buildOverviewRoutes } from "../../../lib/community-overview/routes";

describe("community overview activity CTA routing", () => {
  it("uses deterministic community-scoped preview CTA targets", () => {
    const routes = buildOverviewRoutes(3);

    expect(routes.previews.requests.viewAll).toBe("/communities/3/coordination/requests");
    expect(routes.previews.requests.create).toBe("/communities/3/coordination/requests/new");
    expect(routes.previews.drafts.viewAll).toBe("/communities/3/coordination/drafts");
    expect(routes.previews.drafts.create).toBe("/communities/3/coordination/drafts/new");
    expect(routes.previews.proposals.viewAll).toBe("/communities/3/governance/proposals");
    expect(routes.previews.proposals.create).toBe("/communities/3/governance/proposals/new");
  });
});
