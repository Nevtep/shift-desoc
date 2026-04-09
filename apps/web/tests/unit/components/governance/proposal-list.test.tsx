import { screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ProposalList } from "../../../../components/governance/proposal-list";
import { server } from "../../server";
import { fixtures } from "../../mocks/fixtures";
import { renderWithProviders } from "../../utils";

describe("ProposalList", () => {
  it("shows only proposals in the selected community", async () => {
    renderWithProviders(
      <ProposalList
        communityId={1}
        detailHrefBasePath="/communities/1/governance/proposals"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Proposal 100/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Proposal 102/i)).toBeNull();
    const detailLinks = screen.getAllByRole("link", { name: /view details/i });
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks[0]).toHaveAttribute("href", "/communities/1/governance/proposals/100");
    expect(detailLinks[1]).toHaveAttribute("href", "/communities/1/governance/proposals/101");
  });

  it("maps all supported lifecycle status pills", async () => {
    server.use(
      graphql.query("Proposals", () => {
        const now = new Date("2024-03-01T00:00:00Z").toISOString();
        return HttpResponse.json({
          data: {
            proposals: {
              nodes: fixtures.proposalStates.map((state, idx) => ({
                id: String(200 + idx),
                communityId: 1,
                proposer: fixtures.community.id,
                state,
                createdAt: now,
                queuedAt: state === "Queued" ? now : null,
                executedAt: state === "Executed" ? now : null
              })),
              pageInfo: { endCursor: null, hasNextPage: false }
            }
          }
        });
      })
    );

    renderWithProviders(
      <ProposalList
        communityId={1}
        detailHrefBasePath="/communities/1/governance/proposals"
      />
    );

    for (const state of fixtures.proposalStates) {
      await waitFor(() => {
        expect(screen.getByText(state, { selector: "span" })).toBeInTheDocument();
      });
    }
  });
});
