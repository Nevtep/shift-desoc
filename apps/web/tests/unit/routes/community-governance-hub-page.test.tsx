import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CommunityGovernanceHubPage from "../../../app/communities/[communityId]/governance/page";
import { buildCommunityRouteParams, renderCommunityRoute } from "./community-governance-routes-helpers";

describe("community governance hub route", () => {
  it("renders community context and proposal CTA targets", async () => {
    const ui = await CommunityGovernanceHubPage({ params: buildCommunityRouteParams(7) });
    renderCommunityRoute(ui);

    expect(screen.getByText(/Community #7/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Proposals" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /view all proposals/i })).toHaveAttribute(
      "href",
      "/communities/7/governance/proposals"
    );
    const backLinks = screen.getAllByRole("link", { name: /back to overview/i });
    expect(backLinks.length).toBeGreaterThan(0);
    expect(backLinks[0]).toHaveAttribute("href", "/communities/7");
  });
});
