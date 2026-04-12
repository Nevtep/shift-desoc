import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValuableActionSubmitPreview } from "../../../../components/valuable-actions/valuable-action-submit-preview";
import { validateValuableActionForm } from "../../../../components/valuable-actions/valuable-action-form";

describe("valuable action form preview", () => {
  it("validates title before submit", () => {
    const errors = validateValuableActionForm({
      title: "",
      metadataCid: "",
      ruleSummary: "rule",
      evidenceSummary: "Verify linked artifacts",
      evidenceRequirements: "Artifact URL",
      verificationChecklist: "Matches requested scope",
      referenceLinks: "https://example.com/spec",
      category: "ENGAGEMENT_ONE_SHOT",
      verifierPolicy: "JURY",
      membershipTokenReward: 0,
      communityTokenReward: 0,
      jurorsMin: 1,
      panelSize: 1,
      verifyWindow: 1,
      cooldownPeriod: 1,
      revocable: true,
      proposalThreshold: "0",
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it("renders payload summary", () => {
    render(
      <ValuableActionSubmitPreview
        payload={{
          title: "Review PRs",
          metadataCid: "cid://abc",
          ruleSummary: "Must include evidence",
          evidenceSummary: "Review proof and merged commit",
          evidenceRequirements: "Merged PR URL\nCommit hash",
          verificationChecklist: "Matches task acceptance criteria",
          referenceLinks: "https://example.com/workflow",
          category: "ENGAGEMENT_ONE_SHOT",
          verifierPolicy: "JURY",
          membershipTokenReward: 0,
          communityTokenReward: 0,
          jurorsMin: 3,
          panelSize: 5,
          verifyWindow: 3600,
          cooldownPeriod: 600,
          revocable: true,
          proposalThreshold: "0",
        }}
      />
    );

    expect(screen.getByText(/Review PRs/i)).toBeInTheDocument();
    expect(screen.getByText(/cid:\/\/abc/i)).toBeInTheDocument();
  });
});
