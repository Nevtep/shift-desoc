import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EngagementDetail } from "./engagement-detail";
import { EngagementList } from "./engagement-list";
import { mapEngagementReadiness } from "../../hooks/useEngagementReadiness";
import { server } from "../../tests/unit/server";
import { apiBaseUrl } from "../../tests/unit/mocks/handlers";
import { fixtures } from "../../tests/unit/mocks/fixtures";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";

function readiness(body: Record<string, unknown> | null, status = 200) {
  server.use(
    http.get(`${apiBaseUrl}/communities/84532/engagements/readiness`, () =>
      body ? HttpResponse.json(body, { status }) : new HttpResponse(null, { status: 500 })
    )
  );
}

const lagging = {
  status: "lagging",
  indexedBlock: "100",
  chainHeadBlock: "400",
  blockLag: "300",
  indexedAt: "2020-01-01T00:00:00.000Z",
  details: "Indexer is 300 blocks behind the chain head."
};

describe("mapEngagementReadiness", () => {
  it("does not downgrade a healthy payload because the last activity is old", () => {
    expect(
      mapEngagementReadiness({ status: "healthy", blockLag: "2", indexedAt: "2020-01-01T00:00:00.000Z" }).status
    ).toBe("healthy");
  });

  it("falls back to unavailable for unknown or missing payloads", () => {
    expect(mapEngagementReadiness({ status: "weird" }).status).toBe("unavailable");
    expect(mapEngagementReadiness(null).status).toBe("unavailable");
  });
});

describe("engagement readiness banner", () => {
  it("shows lagging with the block lag on the list when a community is selected", async () => {
    readiness(lagging);
    renderWithProviders(<EngagementList communityId="84532" />);

    expect(await screen.findByText(/Indexer readiness: lagging \(300 blocks behind\)/i)).toBeInTheDocument();
  });

  it("shows healthy", async () => {
    readiness({ ...lagging, status: "healthy", blockLag: "3" });
    renderWithProviders(<EngagementList communityId="84532" />);

    expect(await screen.findByText(/Indexer readiness: healthy/i)).toBeInTheDocument();
  });

  it("shows unavailable when the readiness endpoint fails", async () => {
    readiness(null);
    renderWithProviders(<EngagementList communityId="84532" />);

    expect(await screen.findByText(/Indexer readiness: unavailable/i)).toBeInTheDocument();
  });

  it("is not shown on the list without a community selection", async () => {
    renderWithProviders(<EngagementList />);

    await screen.findByText(/Engagement 50/i);
    expect(screen.queryByLabelText("engagement-readiness-banner")).not.toBeInTheDocument();
  });

  it("shows lagging on the detail page for the engagement's community", async () => {
    readiness(lagging);
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText(/Indexer readiness: lagging/i)).toBeInTheDocument();
  });
});
