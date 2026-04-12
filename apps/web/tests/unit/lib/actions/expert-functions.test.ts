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

  it("includes valuable action propose and activate signatures", () => {
    const signatures = getAllowlistedSignatures("valuableActionRegistry");
    const functions = getAllowlistedFunctionsForTarget(getTargetAbi("valuableActionRegistry"), signatures);
    const resolved = functions.map((entry) => entry.signature);

    expect(resolved).toContain("activateFromGovernance(uint256,bytes32)");
    expect(resolved).toContain(
      "proposeValuableAction((uint32,uint32,uint32,uint8,bytes32,uint32,uint8,bytes32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64),bytes32)"
    );
  });
});
