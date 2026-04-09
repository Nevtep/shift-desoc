import { describe, expect, it } from "vitest";

import { getAllowlistedSignatures } from "../../../../lib/actions/allowlist";
import { getAllowlistedFunctionsForTarget } from "../../../../lib/actions/expert-functions";
import { getTargetAbi } from "../../../../lib/actions/registry";

describe("expert-functions", () => {
  it("returns only exact allowlisted signatures", () => {
    const signatures = getAllowlistedSignatures("treasuryAdapter");
    const functions = getAllowlistedFunctionsForTarget(getTargetAbi("treasuryAdapter"), signatures);

    expect(functions.map((entry) => entry.signature)).toEqual(signatures);
    expect(functions.every((entry) => signatures.includes(entry.signature))).toBe(true);
  });

  it("returns empty array when target has no allowlisted signatures", () => {
    const functions = getAllowlistedFunctionsForTarget(getTargetAbi("verifierManager"), []);
    expect(functions).toEqual([]);
  });
});
