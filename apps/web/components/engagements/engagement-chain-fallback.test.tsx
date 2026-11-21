import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EngagementDetail } from "./engagement-detail";
import type { ChainEngagement } from "../../lib/engagements/chain-state";
import { server } from "../../tests/unit/server";
import { apiBaseUrl } from "../../tests/unit/mocks/handlers";
import { fixtures } from "../../tests/unit/mocks/fixtures";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";

const chainState = vi.hoisted(() => ({
  current: { chain: null as ChainEngagement | null, isLoading: false, isError: false },
  lastParams: null as null | { communityId: number; engagementId: number; enabled: boolean }
}));

vi.mock("../../hooks/useEngagementChainState", () => ({
  useEngagementChainState: (params: { communityId: number; engagementId: number; enabled: boolean }) => {
    chainState.lastParams = params;
    return params.enabled ? chainState.current : { chain: null, isLoading: false, isError: false };
  }
}));

const chainEngagement = (over: Partial<ChainEngagement> = {}): ChainEngagement => ({
  valuableActionId: 200,
  participant: "0xCHAINPARTICIPANT0000000000000000000000000",
  evidenceCid: "cid",
  status: "PENDING",
  createdAt: new Date("2024-04-01T00:00:00Z"),
  verifyDeadline: new Date("2024-04-08T00:00:00Z"),
  jurors: ["0xJUROR000000000000000000000000000000000000"],
  approvals: 1,
  rejections: 0,
  resolved: false,
  ...over
});

function readiness(status: "healthy" | "lagging" | "unavailable") {
  server.use(
    http.get(`${apiBaseUrl}/communities/84532/engagements/readiness`, () =>
      HttpResponse.json({ status, blockLag: status === "lagging" ? "300" : "1", indexedBlock: "1", chainHeadBlock: "2" })
    )
  );
}

describe("EngagementDetail chain fallback", () => {
  beforeEach(() => {
    chainState.current = { chain: null, isLoading: false, isError: false };
    chainState.lastParams = null;
    mockWagmiHooks({ connected: true });
  });

  it("renders chain-sourced data labelled 'Chain (not yet indexed)' when the projection row is missing", async () => {
    readiness("healthy");
    chainState.current = { chain: chainEngagement(), isLoading: false, isError: false };
    renderWithProviders(<EngagementDetail engagementId="84532:999" />);

    expect(await screen.findByText(/Chain \(not yet indexed\)/i)).toBeInTheDocument();
    expect(screen.getByText("0xCHAINPARTICIPANT0000000000000000000000000")).toBeInTheDocument();
    expect(screen.getByText(/Approvals/i)).toBeInTheDocument();
    expect(chainState.lastParams).toMatchObject({ communityId: 84532, engagementId: 999, enabled: true });
  });

  it("says 'Chain-confirmed, indexer pending' when chain is resolved and the projection is still pending", async () => {
    readiness("lagging");
    chainState.current = { chain: chainEngagement({ status: "APPROVED", resolved: true }), isLoading: false, isError: false };
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText(/Chain-confirmed, indexer pending/i)).toBeInTheDocument();
  });

  it("labels 'Indexed' when chain and projection agree", async () => {
    readiness("lagging");
    chainState.current = { chain: chainEngagement({ status: "PENDING" }), isLoading: false, isError: false };
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText("Indexed", { selector: "dd" })).toBeInTheDocument();
  });

  it("does not read the chain when the projection is healthy and the engagement is resolved", async () => {
    readiness("healthy");
    server.use(
      (await import("msw")).graphql.query("Engagement", () =>
        HttpResponse.json({
          data: {
            engagement: { ...fixtures.engagement, status: "APPROVED" },
            jurors: { items: fixtures.engagementJurors }
          }
        })
      )
    );
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText("Indexed", { selector: "dd" })).toBeInTheDocument();
    expect(chainState.lastParams?.enabled).toBe(false);
  });

  it("keeps the 'not indexed yet' state when the chain has no record either", async () => {
    readiness("healthy");
    renderWithProviders(<EngagementDetail engagementId="84532:999" />);

    expect(await screen.findByText(/not indexed yet/i)).toBeInTheDocument();
  });
});
