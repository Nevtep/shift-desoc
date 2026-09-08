import { describe, expect, it } from "vitest";

import {
  buildDraftPersistenceSuffix,
  buildGovernanceFallbackMessage,
} from "../../../../lib/valuable-actions/authority-messages";

describe("buildGovernanceFallbackMessage", () => {
  it("claims not authorized only for the unauthorized status", () => {
    expect(buildGovernanceFallbackMessage("unauthorized", "create", true)).toContain(
      "not authorized for direct creation"
    );
    expect(buildGovernanceFallbackMessage("unauthorized", "edit", true)).toContain(
      "not authorized for direct edits"
    );
  });

  it("describes pending verification for the unknown status", () => {
    const message = buildGovernanceFallbackMessage("unknown", "create", true);
    expect(message).toContain("still being verified");
    expect(message).not.toContain("not authorized");
  });

  it("describes verification failure for the unavailable status", () => {
    const message = buildGovernanceFallbackMessage("unavailable", "edit", true);
    expect(message).toContain("could not be verified");
    expect(message).not.toContain("not authorized");
  });

  it("only claims the payload was saved when persistence succeeded", () => {
    expect(buildGovernanceFallbackMessage("unauthorized", "create", true)).toContain(
      "Payload saved for the governance proposal builder."
    );
    const failed = buildGovernanceFallbackMessage("unauthorized", "create", false);
    expect(failed).not.toContain("Payload saved");
    expect(failed).toContain("could not be saved locally");
  });

  it("always points to the governance proposal builder fallback", () => {
    for (const status of ["unauthorized", "unknown", "unavailable", "verified"] as const) {
      for (const draftSaved of [true, false]) {
        expect(buildGovernanceFallbackMessage(status, "create", draftSaved)).toContain(
          "governance proposal builder"
        );
      }
    }
  });
});

describe("buildDraftPersistenceSuffix", () => {
  it("is truthful about persistence outcome", () => {
    expect(buildDraftPersistenceSuffix(true)).toBe("Payload saved for the governance proposal builder.");
    expect(buildDraftPersistenceSuffix(false)).toContain("could not be saved locally");
  });
});
