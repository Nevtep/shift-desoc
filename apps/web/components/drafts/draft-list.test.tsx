import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DraftList } from "./draft-list";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("DraftList", () => {
  it("renders community-scoped detail links when builder is provided", async () => {
    renderWithProviders(
      <DraftList
        communityId="8"
        detailHrefBuilder={(draft) => `/communities/8/coordination/drafts/${draft.id}`}
      />
    );

    const link = await screen.findByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute("href", "/communities/8/coordination/drafts/10");
  });

  it("renders fallback timestamp when updatedAt is invalid", async () => {
    server.use(
      graphql.query("Drafts", () => {
        return HttpResponse.json({
          data: {
            drafts: {
              nodes: [
                {
                  id: "8:10",
                  requestId: "1",
                  status: "FINALIZED",
                  latestVersionCid: "draft-cid-10",
                  escalatedProposalId: "100",
                  updatedAt: "not-a-date"
                }
              ],
              pageInfo: { endCursor: null, hasNextPage: false }
            }
          }
        });
      })
    );

    renderWithProviders(<DraftList communityId="8" />);

    expect(await screen.findByText(/Updated unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft 10/i)).toBeInTheDocument();
  });
});
