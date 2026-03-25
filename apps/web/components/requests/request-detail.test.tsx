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

    expect(await screen.findByText(/No IPFS body was provided/i)).toBeInTheDocument();
  });

  it("shows mismatch guard when route community does not match request community", async () => {
    renderWithProviders(
      <RequestDetail
        requestId="1"
        expectedCommunityId={8}
        requestListHref="/communities/8/coordination/requests"
        draftHrefBuilder={(draft) => `/communities/8/coordination/drafts/${draft.id}`}
      />
    );

    expect(await screen.findByText(/belongs to Community #1, not Community #8/i)).toBeInTheDocument();
    const correctedLink = screen.getByRole("link", { name: /open the correct route/i });
    expect(correctedLink).toHaveAttribute("href", "/communities/1/coordination/requests/1");
    const draftLink = await screen.findByRole("link", { name: /draft 10/i });
    expect(draftLink).toHaveAttribute("href", "/communities/8/coordination/drafts/10");
  });

  it("decodes URL-encoded composite request ids before querying", async () => {
    server.use(
      graphql.query("Request", ({ variables }) => {
        const id = String((variables as { id?: string } | undefined)?.id ?? "");
        if (id !== "8:1") {
          return HttpResponse.json({ data: { request: null } });
        }

        return HttpResponse.json({
          data: {
            request: {
              id: "8:1",
              requestId: "1",
              communityId: "8",
              author: "0xabc",
              status: "OPEN",
              cid: "request-cid-1",
              tags: [],
              createdAt: new Date().toISOString()
            }
          }
        });
      })
    );

    renderWithProviders(<RequestDetail requestId="8%3A1" expectedCommunityId={8} />);

    expect(await screen.findByText(/ID 1/i)).toBeInTheDocument();
  });
});
