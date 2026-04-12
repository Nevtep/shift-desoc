import { describe, expect, it } from "vitest";

import { evaluateValuableActionAuthorityMode } from "../../../../hooks/useValuableActionAuthorityMode";

describe("valuable action governance routing while lagging", () => {
  it("keeps governance route available when direct write is unavailable", () => {
    const result = evaluateValuableActionAuthorityMode({
      operation: "edit",
      boundaryValid: true,
      hasDirectWrite: false,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(result.mode).toBe("governance_required");
  });
});
