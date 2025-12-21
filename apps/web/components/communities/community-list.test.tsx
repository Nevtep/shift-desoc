import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, graphql } from "msw";

import { CommunityList } from "./community-list";
import { fixtures } from "../../tests/unit/mocks/fixtures";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("CommunityList", () => {
  it("renders loading state initially", () => {
    renderWithProviders(<CommunityList />);
    expect(screen.getByText(/Loading communities/i)).toBeInTheDocument();
  });

  it("renders a list of communities", async () => {
    renderWithProviders(<CommunityList />);

    expect(await screen.findByText(fixtures.community.name)).toBeInTheDocument();
    expect(screen.getByText(`Chain ${fixtures.community.chainId}`)).toBeInTheDocument();
    expect(screen.getByText(`ID ${fixtures.community.id}`)).toBeInTheDocument();
  });

  it("shows empty state when no communities", async () => {
    server.use(
      graphql.query("Communities", () =>
        HttpResponse.json({
          data: { communities: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } }
        })
      )
    );

    renderWithProviders(<CommunityList />);

    expect(await screen.findByText(/No communities indexed yet/i)).toBeInTheDocument();
  });

  it("shows error state and retry control", async () => {
    server.use(
      graphql.query("Communities", () =>
        HttpResponse.json({ errors: [{ message: "fail" }] }, { status: 500 })
      )
    );

    renderWithProviders(<CommunityList />);

    expect(await screen.findByText(/Failed to load communities/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});
