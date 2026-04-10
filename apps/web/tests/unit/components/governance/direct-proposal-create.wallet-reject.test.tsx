import { describe, expect, it, vi } from "vitest";

import { classifySubmitError } from "../../../../lib/governance/direct-proposal-submit";

describe("direct proposal wallet rejection", () => {
  it("maps wallet rejection to non-destructive error state", () => {
    const mapped = classifySubmitError(new Error("User rejected request"));
    expect(mapped.type).toBe("wallet_rejected");
    expect(mapped.message).toMatch(/rejected/i);
  });
});
