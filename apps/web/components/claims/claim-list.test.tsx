import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClaimList } from "./claim-list";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("ClaimList", () => {
  it("renders claims", async () => {
    renderWithProviders(<ClaimList />);

    expect(await screen.findByText(/Claim 50/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(
      graphql.query("Claims", () =>
        HttpResponse.json({ data: { claims: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } } })
      )
    );

    renderWithProviders(<ClaimList />);

    expect(await screen.findByText(/No claims indexed yet/i)).toBeInTheDocument();
  });
});
