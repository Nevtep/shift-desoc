import { describe, expect, it } from "vitest";

import { buildOverviewRoutes } from "../../../lib/community-overview/routes";

describe("community overview route scope", () => {
  it("builds community-scoped routes without query-param leakage", () => {
    const routes = buildOverviewRoutes(7);
    const all = [
      routes.actions.viewParameters,
      routes.actions.editParameters,
      routes.previews.requests.viewAll,
      routes.previews.requests.create,
      routes.previews.drafts.viewAll,
      routes.previews.drafts.create,
      routes.previews.proposals.viewAll,
      routes.previews.proposals.create,
      routes.tabs.overview,
      routes.tabs.coordination,
      routes.tabs.governance,
      routes.tabs.verification,
      routes.tabs.economy,
      routes.tabs.commerce
    ];

    for (const href of all) {
      expect(href.startsWith("/communities/7")).toBe(true);
      expect(href.includes("?communityId=")).toBe(false);
    }
  });
});
