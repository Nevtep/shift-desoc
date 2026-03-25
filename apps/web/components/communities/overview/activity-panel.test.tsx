import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "./activity-panel";

describe("ActivityPanel CTA rendering", () => {
  it("renders links for enabled actions", () => {
    render(
      <ActivityPanel
        panel={{
          domain: "requests",
          state: "empty",
          items: [],
          canRetry: false,
          viewAll: { href: "/communities/1/coordination/requests", enabled: true },
          create: { href: "/communities/1/coordination/requests/new", enabled: true }
        }}
      />
    );

    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/communities/1/coordination/requests"
    );
    expect(screen.getByRole("link", { name: /create new/i })).toHaveAttribute(
      "href",
      "/communities/1/coordination/requests/new"
    );
  });

  it("renders disabled non-link buttons for disabled actions", () => {
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