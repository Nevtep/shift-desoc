import { describe, expect, it } from "vitest";

import {
  validateComposerAllowlist,
  validateDirectProposalPreflight
} from "../../../../lib/governance/direct-proposal-guards";
import { buildBinaryIntent } from "../../components/governance/direct-proposal-create.fixtures";

describe("direct proposal preflight guards", () => {
  it("blocks community context mismatches before wallet prompt", () => {
    const result = validateDirectProposalPreflight({
      intent: buildBinaryIntent(),
      routeCommunityId: 999,
      resolvedGovernorAddress: "0x0000000000000000000000000000000000000200",
      connectedChainId: 84532,
      expectedChainId: 84532
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorType).toBe("context_mismatch");
    }
  });

  it("blocks chain mismatch before wallet prompt", () => {
    const result = validateDirectProposalPreflight({
      intent: buildBinaryIntent(),
      routeCommunityId: 3,
      resolvedGovernorAddress: "0x0000000000000000000000000000000000000200",
      connectedChainId: 1,
      expectedChainId: 84532
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorType).toBe("chain_mismatch");
    }
  });

  it("enforces allowlist signatures and exact target resolution", () => {
    const intent = buildBinaryIntent();
    const result = validateComposerAllowlist({
      intent,
      chainId: 84532,
      moduleAddressMap: {
        draftsManager: "0x0000000000000000000000000000000000000210"
      },
      allowlistedSignaturesByTarget: {
        draftsManager: new Set(["setEscalationPolicy(uint256,(bool,uint8,uint8,uint64))"])
      }
    });

    expect(result).toEqual({ ok: true });
  });
});
