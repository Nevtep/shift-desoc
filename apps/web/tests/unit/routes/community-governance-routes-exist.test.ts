import { describe, expect, it } from "vitest";

describe("community governance route modules", () => {
  it("exports all required community-scoped governance pages", async () => {
    const modules = await Promise.all([
      import("../../../app/communities/[communityId]/governance/page"),
      import("../../../app/communities/[communityId]/governance/proposals/page"),
      import("../../../app/communities/[communityId]/governance/proposals/[proposalId]/page")
    ]);

    for (const mod of modules) {
      expect(typeof mod.default).toBe("function");
    }
  });
});
