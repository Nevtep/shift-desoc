import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTabs } from "../../../components/communities/overview/section-tabs";
import { buildSectionTabs } from "../../../lib/community-overview/availability";

describe("community overview section availability", () => {
  it("shows unavailable sections as disabled with Coming soon", () => {
    const tabs = buildSectionTabs(5);
    render(<SectionTabs tabs={tabs} />);

    const disabledTab = screen.getByRole("button", { name: /Verification/i });
    expect(disabledTab).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /coming soon/i }).length).toBeGreaterThan(0);
  });
});
