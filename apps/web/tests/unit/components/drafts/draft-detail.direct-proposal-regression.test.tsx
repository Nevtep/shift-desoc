import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftDetail } from "../../../../components/drafts/draft-detail";
import { renderWithProviders } from "../../utils";

describe("draft escalation regression with direct proposal feature", () => {
  it("keeps draft escalation controls unchanged", async () => {
    renderWithProviders(
      <DraftDetail
        draftId="10"
        expectedCommunityId={1}
        draftsListHref="/communities/1/coordination/drafts"
        useCommunityScopedRequestLinks
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/escalate to proposal/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /escalate/i })).toBeInTheDocument();
  });
});
