import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "../../../components/communities/overview/activity-panel";

describe("community overview proposals CTA guard", () => {
  it("renders disabled proposals CTAs as coming soon buttons", () => {
    render(
      <ActivityPanel
        panel={{
          domain: "proposals",
          state: "empty",
          items: [],
          canRetry: false,
          viewAll: { href: "/communities/1/governance/proposals", enabled: false, comingSoon: true },
          create: { href: "/communities/1/governance/proposals/new", enabled: false, comingSoon: true }
        }}
      />
    );

    expect(screen.getByRole("button", { name: /view all.*coming soon/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /create new.*coming soon/i })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /view all/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /create new/i })).toBeNull();
  });
});
