import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProposalDetail } from "./proposal-detail";
import { server } from "../../tests/unit/server";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";

const PROPOSAL_ID = "100";

describe("ProposalDetail", () => {
  it("renders metadata, description, and votes", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<ProposalDetail proposalId={PROPOSAL_ID} />);

    expect(await screen.findByText(/Proposal 100/i)).toBeInTheDocument();
    expect(screen.getByText(/Cast Vote/i)).toBeInTheDocument();
    expect(screen.getByText(/Option A/i)).toBeInTheDocument();
    expect(await screen.findByText(/Proposal description content/i)).toBeInTheDocument();
  });

  it("gates vote when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<ProposalDetail proposalId={PROPOSAL_ID} />);

    const submit = await screen.findByRole("button", { name: /Submit vote/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to vote/i)).toBeInTheDocument();
  });

  it("shows error state on failure", async () => {
    server.use(graphql.query("Proposal", () => HttpResponse.json({ errors: [{ message: "fail" }] })));
    renderWithProviders(<ProposalDetail proposalId="does-not-exist" />);

    expect(await screen.findByText(/Failed to load proposal/i)).toBeInTheDocument();
  });
});
