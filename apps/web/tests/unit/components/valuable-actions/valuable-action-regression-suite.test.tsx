import { describe, expect, it } from "vitest";

import { evaluateValuableActionAuthorityMode } from "../../../../hooks/useValuableActionAuthorityMode";
import { evaluateValuableActionBoundary } from "../../../../hooks/useValuableActionBoundary";
import { mapValuableActionReadiness } from "../../../../hooks/useValuableActionReadiness";

describe("valuable action regression suite", () => {
  it("combines boundary, authority, and readiness fail-closed semantics", () => {
    const boundary = evaluateValuableActionBoundary({
      activeCommunityId: 1,
      payloadCommunityId: 1,
      actionId: 2,
      resolvedActionCommunityId: 9,
    });

    const authority = evaluateValuableActionAuthorityMode({
      operation: "activate",
      boundaryValid: boundary.boundaryValid,
      hasDirectWrite: true,
      hasGovernancePath: true,
      isConnected: true,
    });

    const readiness = mapValuableActionReadiness(
      { status: "healthy", indexedAt: "2026-01-01T00:00:00.000Z" },
      new Date("2026-01-01T00:05:00.000Z"),
      30_000
    );

    expect(boundary.boundaryValid).toBe(false);
    expect(authority.mode).toBe("blocked");
    expect(readiness.status).toBe("lagging");
  });
});
