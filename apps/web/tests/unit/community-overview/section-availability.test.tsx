import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTabs } from "../../../components/communities/overview/section-tabs";
import { buildSectionTabs, getManagerCapabilityMetadata } from "../../../lib/community-overview/availability";
import { MANAGER_CAPABILITY_ROUTE_KEYS } from "../../../lib/community-overview/routes";

describe("community overview section availability", () => {
  it("shows unavailable sections as disabled with Coming soon", () => {
    const tabs = buildSectionTabs(5);
    render(<SectionTabs tabs={tabs} />);

    const disabledTab = screen.getByRole("button", { name: /Verification/i });
    expect(disabledTab).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /coming soon/i }).length).toBeGreaterThan(0);
  });

  it("keeps Manager placeholder routes disabled from explicit capability metadata", () => {
    const offers = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFERS);
    const reservations = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATIONS);

    expect(offers).toMatchObject({
      href: "/marketplace/offers",
      enabled: false,
      comingSoon: true,
      status: "unavailable"
    });
    expect(reservations).toMatchObject({
      href: "/housing/reservations",
      enabled: false,
      comingSoon: true,
      status: "unavailable"
    });
  });
});
