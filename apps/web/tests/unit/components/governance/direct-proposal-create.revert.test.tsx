import { describe, expect, it } from "vitest";

import { classifySubmitError } from "../../../../lib/governance/direct-proposal-submit";

describe("direct proposal revert", () => {
  it("maps execution revert to recoverable error messaging", () => {
    const mapped = classifySubmitError(new Error("execution reverted: GovernorInvalidProposalLength"));
    expect(mapped.type).toBe("revert");
    expect(mapped.message).toMatch(/reverted/i);
  });
});
