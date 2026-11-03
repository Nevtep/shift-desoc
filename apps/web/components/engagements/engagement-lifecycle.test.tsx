import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EngagementDetail } from "./engagement-detail";
import { server } from "../../tests/unit/server";
import { fixtures } from "../../tests/unit/mocks/fixtures";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";

vi.mock("../../hooks/useCommunityModules", async () => {
  const json = await import("../../abis/Engagements.json");
  return {
    useCommunityModules: () => ({
      modules: { engagementsManager: "0x0000000000000000000000000000000000000008" },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null
    }),
    COMMUNITY_MODULE_ABIS: { engagements: json.default.abi }
  };
});

const participant = fixtures.engagement.participant as `0x${string}`;

function serve(engagement: Record<string, unknown>, appeals: unknown[] = [], sbts: unknown[] = []) {
  server.use(
    graphql.query("Engagement", () =>
      HttpResponse.json({
        data: {
          engagement: { ...fixtures.engagement, ...engagement },
          jurors: { items: fixtures.engagementJurors },
          appeals: { items: appeals }
        }
      })
    ),
    graphql.query("EngagementSbts", () => HttpResponse.json({ data: { sbts: { items: sbts } } }))
  );
}

const resolvedFields = {
  approvalsCount: 2,
  rejectionsCount: 1,
  resolvedAt: "2024-04-02T00:00:00.000Z",
  resolvedTxHash: "0xresolvedtx",
  lastEventName: "EngagementResolved",
  lastEventTxHash: "0xresolvedtx",
  lastEventBlock: "1234"
};

describe("EngagementDetail lifecycle evidence", () => {
  it("shows tallies and the on-chain event (name, block, explorer link) for a resolved engagement with its SBT", async () => {
    mockWagmiHooks({ connected: true });
    serve({ status: "APPROVED", ...resolvedFields }, [], [{ id: "84532:9", tokenId: 9, kind: "WORK", txHash: "0xresolvedtx" }]);
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText("2 approvals / 1 rejection", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/EngagementResolved/)).toBeInTheDocument();
    expect(screen.getByText(/block 1234/i)).toBeInTheDocument();
    const tx = screen.getAllByRole("link", { name: /0xresolvedtx/i })[0]!;
    expect(tx).toHaveAttribute("href", "https://sepolia.basescan.org/tx/0xresolvedtx");
    expect(await screen.findByText(/SBT minted: token #9/i)).toBeInTheDocument();
  });

  it("does not claim an SBT when none correlates with the resolution tx", async () => {
    mockWagmiHooks({ connected: true });
    serve({ status: "APPROVED", ...resolvedFields });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText(/No SBT record indexed for this engagement/i)).toBeInTheDocument();
    expect(screen.queryByText(/SBT minted/i)).not.toBeInTheDocument();
  });

  it("shows REVOKED with the revoker and tx evidence, and no revoke button", async () => {
    mockWagmiHooks({ connected: true });
    serve({
      status: "REVOKED",
      revokedBy: "0xGOVERNANCE0000000000000000000000000000",
      lastEventName: "EngagementRevoked",
      lastEventTxHash: "0xrevoketx",
      lastEventBlock: "2000",
      resolvedAt: "2024-04-03T00:00:00.000Z"
    });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText("0xGOVERNANCE0000000000000000000000000000")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /0xrevoketx/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /governance/i })).toBeInTheDocument();
  });
});

describe("EngagementDetail appeals", () => {
  const rejected = { status: "REJECTED", approvalsCount: 0, rejectionsCount: 2, resolvedAt: "2024-04-02T00:00:00.000Z" };
  const pendingAppeal = {
    id: "84532:1",
    appealId: 1,
    appellant: participant,
    reason: "The evidence was misread",
    status: "PENDING",
    submittedAt: "2024-04-04T00:00:00.000Z",
    txHash: "0xappealtx"
  };

  it("lists appeals with reason and tx, and states that resolution is not available on-chain", async () => {
    mockWagmiHooks({ connected: true, address: participant });
    serve(rejected, [pendingAppeal]);
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText("The evidence was misread")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /0xappealtx/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Appeal resolution is not available on-chain yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit appeal/i })).not.toBeInTheDocument();
  });

  it("offers 'Submit appeal' only to the participant of a REJECTED engagement without a pending appeal", async () => {
    mockWagmiHooks({ connected: true, address: participant });
    serve(rejected);
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    const button = await screen.findByRole("button", { name: /Submit appeal/i });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Appeal reason/i), "Please re-review");
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(await screen.findByText(/Appeal submitted/i)).toBeInTheDocument();
  });

  it("hides the appeal action from other wallets and for non-rejected engagements", async () => {
    mockWagmiHooks({ connected: true, address: "0x9999999999999999999999999999999999999999" });
    serve(rejected);
    const { unmount } = renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);
    await screen.findByText(/Juror Panel/i);
    expect(screen.queryByRole("button", { name: /Submit appeal/i })).not.toBeInTheDocument();
    unmount();

    mockWagmiHooks({ connected: true, address: participant });
    serve({ status: "APPROVED" });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);
    await screen.findByText(/Juror Panel/i);
    expect(screen.queryByRole("button", { name: /Submit appeal/i })).not.toBeInTheDocument();
  });
});
