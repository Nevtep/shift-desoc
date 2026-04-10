import { describe, expect, it } from "vitest";

import { validateDirectProposalPreflight } from "../../../../lib/governance/direct-proposal-guards";
import { buildBinaryIntent } from "./direct-proposal-create.fixtures";

describe("direct proposal context mismatch", () => {
  it("blocks context mismatch before wallet prompt", () => {
    const result = validateDirectProposalPreflight({
      intent: buildBinaryIntent({ governorAddress: "0x0000000000000000000000000000000000000200" }),
      routeCommunityId: 3,
      resolvedGovernorAddress: "0x0000000000000000000000000000000000000999",
      connectedChainId: 84532,
      expectedChainId: 84532
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorType).toBe("context_mismatch");
  });
});
