import { describe, expect, it } from "vitest";

import { buildParameterSummaryItems } from "../../../hooks/useCommunityOverview";

describe("community overview parameter summary", () => {
  it("builds deterministic parameter rows", () => {
    const rows = buildParameterSummaryItems({
      governance: {
        debateWindow: 600n,
        voteWindow: 1200n,
        executionDelay: 1800n
      },
      eligibility: {
        proposalThreshold: 3n
      },
      revenue: {
        minTreasuryBps: 2500,
        minPositionsBps: 3500,
        spilloverTarget: 2,
        spilloverSplitBpsToTreasury: 4000
      },
      verifier: {
        verifierPanelSize: 5n,
        verifierMin: 3n
      }
    });

    expect(rows.map((row) => row.id)).toEqual([
      "governance.debateWindow",
      "governance.votingWindow",
      "governance.executionDelay",
      "eligibility.proposalThreshold",
      "economics.revenueSplit.workersBps",
      "economics.revenueSplit.treasuryBps",
      "economics.revenueSplit.investorsBps",
      "verifier.panelSize",
      "verifier.minimumApprovals"
    ]);
  });

  it("marks unavailable values without hiding rows", () => {
    const rows = buildParameterSummaryItems(null);
    expect(rows).toHaveLength(9);
    expect(rows.every((row) => row.value === "unavailable")).toBe(true);
  });
});
