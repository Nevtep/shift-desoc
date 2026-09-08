import { describe, expect, it } from "vitest";

import { buildGovernanceFallbackMessage } from "../../../../lib/valuable-actions/authority-messages";

describe("buildGovernanceFallbackMessage", () => {
  it("claims not authorized only for the unauthorized status", () => {
    expect(buildGovernanceFallbackMessage("unauthorized", "create")).toContain("not authorized for direct creation");
    expect(buildGovernanceFallbackMessage("unauthorized", "edit")).toContain("not authorized for direct edits");
  });

  it("describes pending verification for the unknown status", () => {
    const message = buildGovernanceFallbackMessage("unknown", "create");
    expect(message).toContain("still being verified");
    expect(message).not.toContain("not authorized");
  });

  it("describes verification failure for the unavailable status", () => {
    const message = buildGovernanceFallbackMessage("unavailable", "edit");
    expect(message).toContain("could not be verified");
    expect(message).not.toContain("not authorized");
  });

  it("always points to the governance proposal builder fallback", () => {
    for (const status of ["unauthorized", "unknown", "unavailable", "verified"] as const) {
      expect(buildGovernanceFallbackMessage(status, "create")).toContain("governance proposal builder");
    }
  });
});
