import { describe, expect, it } from "vitest";

import { executeMutationByMode } from "../../../../hooks/useValuableActionAdminMutations";

describe("valuable action governance routing", () => {
  it("produces governance route result when mode is governance_required", async () => {
    const result = await executeMutationByMode("governance_required", {
      communityId: 1,
      actionId: 2,
      title: "Update action",
    });

    expect(result.route).toBe("governance");
    expect(result.status).toBe("submitted");
  });
});
