import { render, screen } from "@testing-library/react";
import { Fragment, createElement } from "react";
import { describe, expect, it } from "vitest";

import { ActivityPanel } from "../../../components/communities/overview/activity-panel";
import { OverviewHeader } from "../../../components/communities/overview/overview-header";
import { buildOverviewRoutes } from "../../../lib/community-overview/routes";

describe("community routing allowlist", () => {
  it("emits only exact scoped coordination routes for requests and drafts", () => {
    const routes = buildOverviewRoutes(9);

    expect(routes.previews.requests.viewAll).toBe("/communities/9/coordination/requests");
    expect(routes.previews.requests.create).toBe("/communities/9/coordination/requests/new");
    expect(routes.previews.drafts.viewAll).toBe("/communities/9/coordination/drafts");
    expect(routes.previews.drafts.create).toBe("/communities/9/coordination/drafts/new");

    const emitted = [
      routes.previews.requests.viewAll,
      routes.previews.requests.create,
      routes.previews.drafts.viewAll,
      routes.previews.drafts.create
    ];

    for (const href of emitted) {
      expect(href.includes("/requests/") || href.endsWith("/requests") || href.includes("/drafts/") || href.endsWith("/drafts")).toBe(true);
      expect(href.includes("coordination-hub")).toBe(false);
      expect(href.includes("?communityId=")).toBe(false);
    }
  });

  it("renders proposals view-all and create as enabled links while parameters remain disabled", () => {
    render(
      createElement(
        Fragment,
        null,
        createElement(ActivityPanel, {
          panel: {
            domain: "proposals",
            state: "empty",
            items: [],
            canRetry: false,
            viewAll: { href: "/communities/9/governance/proposals", enabled: true, comingSoon: false },
            create: { href: "/communities/9/governance/proposals/new", enabled: true, comingSoon: false }
          }
        }),
        createElement(OverviewHeader, {
          header: {
            communityId: 9,
            displayName: "Community #9",
            network: "Base Sepolia",
            environment: "staging",
            health: "synced",
            lastCheckedAt: new Date().toISOString(),
            actions: {
              valuableActions: {
                href: "/community/9/valuable-actions",
                enabled: true,
                comingSoon: false
              },
              viewParameters: {
                href: "/communities/9/parameters",
                enabled: false,
                comingSoon: true
              },
              editParameters: {
                href: "/communities/9/parameters/edit",
                enabled: false,
                comingSoon: true
              }
            }
          }
        })
      )
    );

    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/communities/9/governance/proposals"
    );
    expect(screen.getByRole("link", { name: /create new/i })).toHaveAttribute(
      "href",
      "/communities/9/governance/proposals/new"
    );
    expect(screen.getByRole("button", { name: /view parameters.*coming soon/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: /valuable actions/i })).toHaveAttribute(
      "href",
      "/community/9/valuable-actions"
    );

    expect(screen.queryByRole("link", { name: /view parameters/i })).toBeNull();
  });
});