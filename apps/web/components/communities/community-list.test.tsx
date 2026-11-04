import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();
    expect(screen.getByText(`Community #${fixtures.community.id}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View community/i })).toHaveAttribute(
      "href",
      `/communities/${fixtures.community.id}`
    );
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

  it("leaves the loading state with an error card when the indexer hangs, and recovers on retry", async () => {
    let healthy = false;
    server.use(
      graphql.query("Communities", async () => {
        if (!healthy) await new Promise(() => undefined);
        return HttpResponse.json({
          data: { communities: { nodes: [fixtures.community], pageInfo: { endCursor: null, hasNextPage: false } } }
        });
      })
    );

    renderWithProviders(<CommunityList />, { requestDeadlineMs: 50 });

    expect(await screen.findByText(/Failed to load communities/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading communities/i)).not.toBeInTheDocument();

    healthy = true;
    await userEvent.click(screen.getByRole("button", { name: /Retry/i }));

    expect(await screen.findByText(fixtures.community.name)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Failed to load communities/i)).not.toBeInTheDocument());
  });

  it("shows the error card for a 502 from the indexer", async () => {
    server.use(
      graphql.query("Communities", () =>
        HttpResponse.json({ errors: [{ message: "Application failed to respond" }] }, { status: 502 })
      )
    );
    renderWithProviders(<CommunityList />);
    expect(await screen.findByText(/Failed to load communities/i)).toBeInTheDocument();
  });
});
