import { describe, expect, it } from "vitest";

import { evaluateValuableActionAuthorityMode } from "../../../../hooks/useValuableActionAuthorityMode";

describe("valuable action admin routing matrix", () => {
  it("routes to direct write when direct authority exists", () => {
    const mode = evaluateValuableActionAuthorityMode({
      operation: "create",
      boundaryValid: true,
      hasDirectWrite: true,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(mode.mode).toBe("direct_write");
  });

  it("routes to governance when direct authority is missing", () => {
    const mode = evaluateValuableActionAuthorityMode({
      operation: "edit",
      boundaryValid: true,
      hasDirectWrite: false,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(mode.mode).toBe("governance_required");
  });
});
