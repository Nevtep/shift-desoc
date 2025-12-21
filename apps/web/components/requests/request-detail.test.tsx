import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestDetail } from "./request-detail";
import { server } from "../../tests/unit/server";
import { renderWithProviders } from "../../tests/unit/utils";

describe("RequestDetail", () => {
  it("renders request metadata and IPFS content", async () => {
    renderWithProviders(<RequestDetail requestId="1" />);

    expect(await screen.findByText(/Request title/i)).toBeInTheDocument();
    expect(screen.getByText(/ID 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Author/i)).toBeInTheDocument();
    expect(await screen.findByText(/Request body/i)).toBeInTheDocument();
    expect(screen.getByText(/Drafts/i)).toBeInTheDocument();
  });

  it("shows error state when request fails", async () => {
    server.use(graphql.query("Request", () => HttpResponse.json({ errors: [{ message: "Fail" }] })));

    renderWithProviders(<RequestDetail requestId="999" />);

    expect(await screen.findByText(/Failed to load request/i)).toBeInTheDocument();
  });

  it("shows IPFS error state when content fails", async () => {
    server.use(
      graphql.query("Request", ({ variables }) => {
        return HttpResponse.json({
          data: {
            request: {
              id: String((variables as { id?: number }).id),
              communityId: "1",
              author: "0xabc",
              status: "OPEN",
              cid: "missing-cid",
              tags: [],
              createdAt: new Date().toISOString()
            }
          }
        });
      })
    );

    renderWithProviders(<RequestDetail requestId="2" />);

    expect(await screen.findByText(/No markdown content available/i)).toBeInTheDocument();
  });
});
