import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftDetail } from "./draft-detail";
import { server } from "../../tests/unit/server";
import { renderWithProviders, mockWagmiHooks } from "../../tests/unit/utils";
import { fixtures } from "../../tests/unit/mocks/fixtures";

describe("DraftDetail", () => {
  it("renders metadata, latest version, and reviews", async () => {
    mockWagmiHooks({ connected: false });

    renderWithProviders(<DraftDetail draftId={fixtures.draft.id} />);

    const content = await screen.findAllByText(/Draft content/i);
    expect(content.length).toBeGreaterThan(0);
    expect(screen.getByText(/^Draft 10$/i)).toBeInTheDocument();
    expect(screen.queryByText(/No markdown content available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No reviews submitted yet/i)).not.toBeInTheDocument();
  });

  it("disables escalation when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<DraftDetail draftId={fixtures.draft.id} />);

    const button = await screen.findByRole("button", { name: /Escalate/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to escalate/i)).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    server.use(http.get("http://localhost:4000/drafts/:draftId", () => HttpResponse.json({ draft: null }, { status: 500 })));
    renderWithProviders(<DraftDetail draftId="404" />);

    expect(await screen.findByText(/Failed to load draft/i)).toBeInTheDocument();
  });

  it("shows mismatch guard when route community does not match draft community", async () => {
    mockWagmiHooks({ connected: false });

    renderWithProviders(
      <DraftDetail
        draftId={fixtures.draft.id}
        expectedCommunityId={8}
        draftsListHref="/communities/8/coordination/drafts"
        requestHrefBuilder={(requestId, communityId) =>
          `/communities/${communityId}/coordination/requests/${requestId}`
        }
      />
    );

    expect(await screen.findByText(/belongs to Community #1, not Community #8/i)).toBeInTheDocument();
    const correctedLink = screen.getByRole("link", { name: /open the correct route/i });
    expect(correctedLink).toHaveAttribute("href", "/communities/1/coordination/drafts/10");
    const requestLink = screen.getByRole("link", { name: "1" });
    expect(requestLink).toHaveAttribute("href", "/communities/1/coordination/requests/1");
  });

  it("renders safely when draft payload omits reviews", async () => {
    mockWagmiHooks({ connected: false });

    server.use(
      http.get("http://localhost:4000/drafts/:draftId", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            versions: fixtures.draftVersions
          }
        });
      })
    );

    renderWithProviders(<DraftDetail draftId={fixtures.draft.id} />);

    expect(await screen.findByText(/No reviews submitted yet/i)).toBeInTheDocument();
  });
});
