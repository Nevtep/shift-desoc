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
    expect(screen.getByText(/Draft 10/i)).toBeInTheDocument();
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
});
