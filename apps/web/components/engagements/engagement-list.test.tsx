import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EngagementList } from "./engagement-list";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("EngagementList", () => {
  it("renders engagements", async () => {
    renderWithProviders(<EngagementList />);

    expect(await screen.findByText(/Engagement 50/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(
      graphql.query("Engagements", () =>
        HttpResponse.json({ data: { engagements: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } } })
      )
    );

    renderWithProviders(<EngagementList />);

    expect(await screen.findByText(/No engagements indexed yet/i)).toBeInTheDocument();
  });
});
