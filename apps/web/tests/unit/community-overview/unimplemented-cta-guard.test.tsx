import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTabs } from "../../../components/communities/overview/section-tabs";
import { buildSectionTabs } from "../../../lib/community-overview/availability";

describe("community overview unimplemented CTA guard", () => {
  it("does not render link anchors for disabled destinations", () => {
    const tabs = buildSectionTabs(9);
    render(<SectionTabs tabs={tabs} />);

    expect(screen.queryByRole("link", { name: /Verification/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Economy/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Commerce/i })).toBeNull();
  });
});
