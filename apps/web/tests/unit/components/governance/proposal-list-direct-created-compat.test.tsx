import { screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ProposalList } from "../../../../components/governance/proposal-list";
import { server } from "../../server";
import { renderWithProviders } from "../../utils";

describe("proposal list compatibility for direct-created proposals", () => {
  it("renders community-scoped proposals regardless of source path", async () => {
    server.use(
      graphql.query("Proposals", () => {
        return HttpResponse.json({
          data: {
            proposals: {
              nodes: [{
                id: "777",
                communityId: 3,
                proposer: "0x0000000000000000000000000000000000000001",
                state: "Pending",
                createdAt: new Date("2026-04-10T00:00:00Z").toISOString(),
                queuedAt: null,
                executedAt: null
              }],
              pageInfo: { endCursor: null, hasNextPage: false }
            }
          }
        });
      })
    );

    renderWithProviders(
      <ProposalList communityId={3} detailHrefBasePath="/communities/3/governance/proposals" />
    );

    await waitFor(() => {
      expect(screen.getByText(/proposal 777/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute(
      "href",
      "/communities/3/governance/proposals/777"
    );
  });
});
