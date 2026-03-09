import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, graphql } from "msw";

import { CommunityList } from "../../../components/communities/community-list";
import { fixtures } from "../mocks/fixtures";
import { server } from "../server";
import { renderWithProviders } from "../utils";

describe("CommunityList multi-community", () => {
  it("renders multiple communities without single-community assumptions", async () => {
    server.use(
      graphql.query("Communities", () =>
        HttpResponse.json({
          data: {
            communities: {
              nodes: [
                fixtures.community,
                {
                  ...fixtures.community,
                  id: "2",
                  name: "Beta",
                  metadataUri: null
                }
              ],
              pageInfo: { endCursor: null, hasNextPage: false }
            }
          }
        })
      )
    );

    renderWithProviders(<CommunityList />);

    const links = await screen.findAllByRole("link", { name: /View community/i });
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/communities/1");
    expect(links[1]).toHaveAttribute("href", "/communities/2");
  });
});
