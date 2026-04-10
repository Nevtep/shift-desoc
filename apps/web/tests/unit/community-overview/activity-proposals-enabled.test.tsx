import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "../../../components/communities/overview/activity-panel";

describe("community overview proposals CTA", () => {
  it("renders View all and Create new as enabled links", () => {
    render(
      <ActivityPanel
        panel={{
          domain: "proposals",
          state: "ready",
          items: [],
          canRetry: false,
          viewAll: { href: "/communities/9/governance/proposals", enabled: true, comingSoon: false },
          create: { href: "/communities/9/governance/proposals/new", enabled: true, comingSoon: false }
        }}
      />
    );

    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/communities/9/governance/proposals"
    );
    expect(screen.getByRole("link", { name: /create new/i })).toHaveAttribute(
      "href",
      "/communities/9/governance/proposals/new"
    );
  });
});
