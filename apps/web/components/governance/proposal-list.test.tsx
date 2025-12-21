import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProposalList } from "./proposal-list";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("ProposalList", () => {
  it("renders proposals from indexer", async () => {
    renderWithProviders(<ProposalList />);

    expect(await screen.findByText(/Proposal 100/i)).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(
      graphql.query("Proposals", () =>
        HttpResponse.json({ data: { proposals: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } } })
      )
    );

    renderWithProviders(<ProposalList />);

    expect(await screen.findByText(/No proposals indexed yet/i)).toBeInTheDocument();
  });

  it("shows retry on error", async () => {
    server.use(graphql.query("Proposals", () => HttpResponse.json({ errors: [{ message: "oops" }] })));

    renderWithProviders(<ProposalList />);

    expect(await screen.findByText(/Failed to load proposals/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});
