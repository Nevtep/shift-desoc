import { describe, expect, it } from "vitest";

import { createDefaultDeploymentConfig, validateDeploymentConfig } from "../../../../lib/deploy/config";

function validConfig() {
  return {
    ...createDefaultDeploymentConfig("0x1111111111111111111111111111111111111111"),
    communityName: "Shift",
    communityDescription: "Desc",
    treasuryStableToken: "0x2222222222222222222222222222222222222222",
    supportedTokensCsv: "0x2222222222222222222222222222222222222222",
    authorityMode: "governance_managed" as const
  };
}

describe("deployment config authority mode", () => {
  it("has no pre-selected authority mode", () => {
    expect(createDefaultDeploymentConfig().authorityMode).toBe("");
  });

  it("requires an authority mode", () => {
    const result = validateDeploymentConfig({ ...validConfig(), authorityMode: "" });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Authority mode is required (Admin-managed or Governance-managed).");
  });

  it("rejects an unknown authority mode", () => {
    const result = validateDeploymentConfig({ ...validConfig(), authorityMode: "other" as never });
    expect(result.isValid).toBe(false);
  });

  it.each(["admin_managed", "governance_managed"] as const)("accepts %s", (mode) => {
    expect(validateDeploymentConfig({ ...validConfig(), authorityMode: mode }).isValid).toBe(true);
  });
});
