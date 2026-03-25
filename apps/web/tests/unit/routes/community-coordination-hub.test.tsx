import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CommunityCoordinationHubPage from "../../../app/communities/[communityId]/coordination/page";
import { renderWithProviders } from "../utils";

describe("community coordination hub route", () => {
  it("renders requests and drafts cards with scoped CTA targets", async () => {
    const ui = await CommunityCoordinationHubPage({
      params: Promise.resolve({ communityId: "7" })
    });

    renderWithProviders(ui);

    expect(screen.getByRole("heading", { name: "Requests" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Drafts" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /create request/i })).toHaveAttribute(
      "href",
      "/communities/7/coordination/requests/new"
    );
    expect(screen.getByRole("link", { name: /view all requests/i })).toHaveAttribute(
      "href",
      "/communities/7/coordination/requests"
    );
    expect(screen.getByRole("link", { name: /create draft/i })).toHaveAttribute(
      "href",
      "/communities/7/coordination/drafts/new"
    );
    expect(screen.getByRole("link", { name: /view all drafts/i })).toHaveAttribute(
      "href",
      "/communities/7/coordination/drafts"
    );
  });

  it("keeps requests and drafts cards visually symmetric", async () => {
    const ui = await CommunityCoordinationHubPage({
      params: Promise.resolve({ communityId: "7" })
    });

    renderWithProviders(ui);

    const requestsCard = screen.getByRole("heading", { name: "Requests" }).closest("article");
    const draftsCard = screen.getByRole("heading", { name: "Drafts" }).closest("article");

    expect(requestsCard).toBeTruthy();
    expect(draftsCard).toBeTruthy();
    expect(requestsCard?.className).toBe(draftsCard?.className);
  });
});