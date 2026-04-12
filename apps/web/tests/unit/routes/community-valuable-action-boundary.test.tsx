import { describe, expect, it } from "vitest";

import { evaluateValuableActionBoundary } from "../../../hooks/useValuableActionBoundary";

describe("community valuable action route boundary", () => {
  it("blocks cross-community action ids", () => {
    const result = evaluateValuableActionBoundary({
      activeCommunityId: 11,
      payloadCommunityId: 11,
      actionId: 4,
      resolvedActionCommunityId: 99,
    });

    expect(result.boundaryValid).toBe(false);
    expect(result.reasonCode).toBe("community_mismatch");
  });
});
