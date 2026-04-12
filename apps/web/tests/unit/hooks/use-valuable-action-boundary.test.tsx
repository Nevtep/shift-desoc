import { describe, expect, it } from "vitest";

import { evaluateValuableActionBoundary } from "../../../hooks/useValuableActionBoundary";

describe("evaluateValuableActionBoundary", () => {
  it("accepts valid in-community payload", () => {
    const result = evaluateValuableActionBoundary({
      activeCommunityId: 7,
      payloadCommunityId: 7,
      actionId: 11,
      resolvedActionCommunityId: 7,
    });

    expect(result.boundaryValid).toBe(true);
    expect(result.reasonCode).toBe("ok");
  });

  it("rejects route/payload mismatch", () => {
    const result = evaluateValuableActionBoundary({
      activeCommunityId: 7,
      payloadCommunityId: 8,
      actionId: 11,
    });

    expect(result.boundaryValid).toBe(false);
    expect(result.reasonCode).toBe("community_mismatch");
  });

  it("rejects resolved action crossing community boundary", () => {
    const result = evaluateValuableActionBoundary({
      activeCommunityId: 7,
      payloadCommunityId: 7,
      actionId: 11,
      resolvedActionCommunityId: 9,
    });

    expect(result.boundaryValid).toBe(false);
    expect(result.reasonCode).toBe("community_mismatch");
  });
});
