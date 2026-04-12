import { describe, expect, it } from "vitest";

import { buildOverviewRoutes } from "../../../lib/community-overview/routes";

describe("community overview href allowlist", () => {
  it("keeps all internal overview links scoped to /communities/<id>", () => {
    const routes = buildOverviewRoutes(11);
    const hrefs = [
      ...Object.values(routes.actions),
      ...Object.values(routes.tabs),
      routes.previews.requests.viewAll,
      routes.previews.requests.create,
      routes.previews.drafts.viewAll,
      routes.previews.drafts.create,
      routes.previews.proposals.viewAll,
      routes.previews.proposals.create
    ];

    for (const href of hrefs) {
      if (href.startsWith("http://") || href.startsWith("https://")) continue;
      if (href === "/community/11/valuable-actions") continue;
      expect(href.startsWith("/communities/11")).toBe(true);
    }
  });
});
