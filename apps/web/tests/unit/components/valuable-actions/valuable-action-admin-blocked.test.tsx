import { describe, expect, it } from "vitest";

import { executeMutationByMode } from "../../../../hooks/useValuableActionAdminMutations";

describe("valuable action blocked feedback", () => {
  it("returns blocked state and explicit message", async () => {
    const result = await executeMutationByMode("blocked", {
      communityId: 1,
      actionId: 9,
    });

    expect(result.status).toBe("blocked");
    expect(result.message).toMatch(/blocked/i);
  });
});
