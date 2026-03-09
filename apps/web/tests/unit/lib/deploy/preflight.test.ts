import { describe, expect, it } from "vitest";

import { buildPreflightAssessment, estimateFunding } from "../../../../lib/deploy/preflight";

describe("preflight", () => {
  it("calculates required funds with volatility buffer", () => {
    const funding = estimateFunding({
      estimatedTxCount: 10,
      estimatedGasPerTx: 100_000n,
      maxFeePerGasWei: 2_000_000_000n,
      currentBalanceWei: 1_000_000_000_000_000n,
      bufferMultiplierBps: 12500
    });

    expect(funding.requiredWei).toBeGreaterThan(0n);
    expect(funding.bufferMultiplierBps).toBe(12500);
  });

  it("blocks start when wallet/network/shared infra/funds fail", () => {
    const funding = estimateFunding({
      estimatedTxCount: 50,
      estimatedGasPerTx: 500_000n,
      maxFeePerGasWei: 10_000_000_000n,
      currentBalanceWei: 1n
    });

    const assessment = buildPreflightAssessment({
      walletConnected: false,
      chainId: 1,
      connectedAddress: undefined,
      supportedChainIds: [84532],
      sharedInfra: {
        addressesPresent: false,
        accessManager: { hasCode: false, abiProbePassed: false },
        paramController: { hasCode: false, abiProbePassed: false },
        communityRegistry: { hasCode: false, abiProbePassed: false },
        isUsable: false
      },
      funding
    });

    expect(assessment.blockingReasons.length).toBeGreaterThanOrEqual(3);
    expect(assessment.blockingReasons.join(" ")).toContain("Connect wallet");
    expect(assessment.blockingReasons.join(" ")).toContain("supported network");
    expect(assessment.blockingReasons.join(" ")).toContain("Shared infrastructure");
  });
});
