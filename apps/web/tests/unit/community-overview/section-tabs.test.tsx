import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTabs } from "../../../components/communities/overview/section-tabs";
import { buildSectionTabs } from "../../../lib/community-overview/availability";

describe("community overview section tabs", () => {
  it("renders all six sections in fixed order", () => {
    const tabs = buildSectionTabs(5);
    render(<SectionTabs tabs={tabs} />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Coordination")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verification/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Economy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Commerce/i })).toBeInTheDocument();
  });
});
