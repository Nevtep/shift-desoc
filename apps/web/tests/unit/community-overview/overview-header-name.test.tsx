import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverviewHeader } from "../../../components/communities/overview/overview-header";
import { buildOverviewHeaderState, resolveCommunityDisplayName } from "../../../hooks/useCommunityOverview";

describe("community display name", () => {
  it("prefers the name chosen by the creator", () => {
    expect(resolveCommunityDisplayName(11, "  Huerto del Barrio ")).toBe("Huerto del Barrio");
  });

  it("falls back to the numeric label when the indexer has no name", () => {
    expect(resolveCommunityDisplayName(11, null)).toBe("Community #11");
    expect(resolveCommunityDisplayName(11, "   ")).toBe("Community #11");
    expect(resolveCommunityDisplayName(11, undefined)).toBe("Community #11");
  });

  it("shows the chosen name as the title and keeps the id as secondary text", () => {
    const header = buildOverviewHeaderState({
      communityId: 11,
      displayName: "Huerto del Barrio",
      health: "synced",
      canEdit: false
    });
    render(<OverviewHeader header={header} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Huerto del Barrio");
    expect(screen.getByText(/ID 11/)).toBeInTheDocument();
  });
});
