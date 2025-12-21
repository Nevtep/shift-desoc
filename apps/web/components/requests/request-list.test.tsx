import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestList } from "./request-list";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";
import { fixtures } from "../../tests/unit/mocks/fixtures";

describe("RequestList", () => {
  it("renders loading then populated list", async () => {
    renderWithProviders(<RequestList />);

    expect(screen.getByText(/Loading requests/i)).toBeInTheDocument();

    expect(await screen.findByText(/Request title/i)).toBeInTheDocument();
    expect(screen.getByText(/Alpha/i)).toBeInTheDocument();
    expect(screen.getByText(/Author:/i)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    server.use(
      graphql.query("Requests", () =>
        HttpResponse.json({
          data: {
            requests: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
          }
        })
      )
    );

    renderWithProviders(<RequestList />);

    expect(await screen.findByText(/No requests indexed yet/i)).toBeInTheDocument();
  });

  it("shows error state and allows retry", async () => {
    const errorHandler = graphql.query("Requests", () => HttpResponse.json({ errors: [{ message: "Boom" }] }));
    server.use(errorHandler);

    renderWithProviders(<RequestList />);

    expect(await screen.findByText(/Failed to load requests/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry/i)).toBeInTheDocument();
  });

  it("filters by community id when provided", async () => {
    const handler = graphql.query("Requests", ({ variables }) => {
      const communityId = (variables as { communityId?: number } | undefined)?.communityId;
      if (communityId === 999) {
        return HttpResponse.json({
          data: { requests: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } } }
        });
      }
      return HttpResponse.json({
        data: { requests: { nodes: [fixtures.request], pageInfo: { endCursor: null, hasNextPage: false } } }
      });
    });

    server.use(handler);

    renderWithProviders(<RequestList communityId="999" />);

    expect(await screen.findByText(/No requests indexed yet/i)).toBeInTheDocument();
  });
});
