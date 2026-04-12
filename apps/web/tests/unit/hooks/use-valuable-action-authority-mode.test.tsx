import { describe, expect, it } from "vitest";

import { evaluateValuableActionAuthorityMode } from "../../../hooks/useValuableActionAuthorityMode";

describe("evaluateValuableActionAuthorityMode", () => {
  it("fails closed when boundary is invalid", () => {
    const result = evaluateValuableActionAuthorityMode({
      operation: "create",
      boundaryValid: false,
      hasDirectWrite: true,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasonCode).toBe("boundary_invalid");
  });

  it("returns direct_write only when direct write authority exists", () => {
    const result = evaluateValuableActionAuthorityMode({
      operation: "edit",
      boundaryValid: true,
      hasDirectWrite: true,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(result.mode).toBe("direct_write");
  });

  it("returns governance_required when direct write is unavailable but governance exists", () => {
    const result = evaluateValuableActionAuthorityMode({
      operation: "activate",
      boundaryValid: true,
      hasDirectWrite: false,
      hasGovernancePath: true,
      isConnected: true,
    });

    expect(result.mode).toBe("governance_required");
  });

  it("returns blocked when no authority path exists", () => {
    const result = evaluateValuableActionAuthorityMode({
      operation: "deactivate",
      boundaryValid: true,
      hasDirectWrite: false,
      hasGovernancePath: false,
      isConnected: true,
    });

    expect(result.mode).toBe("blocked");
    expect(result.reasonCode).toBe("no_authority_path");
  });
});
