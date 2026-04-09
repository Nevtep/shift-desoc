import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "../../../components/communities/overview/activity-panel";

describe("community overview proposals CTA", () => {
  it("renders View all as enabled link and Create new as disabled button", () => {
    render(
      <ActivityPanel
        panel={{
          domain: "proposals",
          state: "ready",
          items: [],
          canRetry: false,
          viewAll: { href: "/communities/9/governance/proposals", enabled: true, comingSoon: false },
          create: { href: "/communities/9/governance/proposals/new", enabled: false, comingSoon: true }
        }}
      />
    );

    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/communities/9/governance/proposals"
    );
    expect(screen.getByRole("button", { name: /create new.*coming soon/i })).toBeDisabled();
  });
});
