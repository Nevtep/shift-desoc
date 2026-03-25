import { describe, expect, it } from "vitest";

describe("community coordination route modules", () => {
  it("exports all required community-scoped coordination pages", async () => {
    const modules = await Promise.all([
      import("../../../app/communities/[communityId]/coordination/page"),
      import("../../../app/communities/[communityId]/coordination/requests/page"),
      import("../../../app/communities/[communityId]/coordination/requests/new/page"),
      import("../../../app/communities/[communityId]/coordination/requests/[requestId]/page"),
      import("../../../app/communities/[communityId]/coordination/drafts/page"),
      import("../../../app/communities/[communityId]/coordination/drafts/new/page"),
      import("../../../app/communities/[communityId]/coordination/drafts/[draftId]/page")
    ]);

    for (const mod of modules) {
      expect(typeof mod.default).toBe("function");
    }
  });
});
