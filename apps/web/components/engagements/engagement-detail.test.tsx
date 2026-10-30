import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EngagementDetail } from "./engagement-detail";
import { server } from "../../tests/unit/server";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";
import { fixtures } from "../../tests/unit/mocks/fixtures";

describe("EngagementDetail", () => {
  it("renders metadata, evidence, and juror table", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText(/Engagement 50/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByText(/Juror Panel/i)).toBeInTheDocument();
    expect(await screen.findByText(fixtures.engagement.participant)).toBeInTheDocument();
    expect(await screen.findByText(fixtures.engagementJurors[0].juror)).toBeInTheDocument();
  });

  it("shows a not-indexed-yet state when the projection has no row", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementDetail engagementId="84532:999" />);

    expect(await screen.findByText(/not indexed yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load engagement/i)).not.toBeInTheDocument();
  });

  it("rejects ids that are not the composite community:engagement id", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementDetail engagementId="50" />);

    expect(await screen.findByText(/not a valid engagement id/i)).toBeInTheDocument();
  });

  it("links related proposals to the community-scoped list", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    const link = await screen.findByRole("link", { name: /View related governance proposals/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/communities\/\d+\/governance\/proposals\?engagementId=/)
    );
  });

  it("gates verification when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    const submit = await screen.findByRole("button", { name: /Submit verification/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to verify/i)).toBeInTheDocument();
  });

  it("shows juror warning when connected but not assigned", async () => {
    mockWagmiHooks({ connected: true, address: "0x9999999999999999999999999999999999999999" });
    renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

    expect(await screen.findByText(/You are not assigned as a juror/i)).toBeInTheDocument();
  });

  describe("verify gating by indexer status", () => {
    const juror = fixtures.engagementJurors[0].juror as `0x${string}`;

    function useStatus(status: string) {
      server.use(
        graphql.query("Engagement", () =>
          HttpResponse.json({
            data: {
              engagement: { ...fixtures.engagement, status },
              jurors: { items: fixtures.engagementJurors }
            }
          })
        )
      );
    }

    it("enables verification for an assigned juror while PENDING", async () => {
      mockWagmiHooks({ connected: true, address: juror });
      useStatus("PENDING");
      renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

      expect(await screen.findByRole("button", { name: /Submit verification/i })).toBeEnabled();
      expect(screen.getByText("Pending", { selector: "dd" })).toBeInTheDocument();
    });

    it.each([
      ["APPROVED", "Approved"],
      ["REJECTED", "Rejected"],
      ["REVOKED", "Revoked"]
    ])("disables verification and labels %s", async (status, label) => {
      mockWagmiHooks({ connected: true, address: juror });
      useStatus(status);
      renderWithProviders(<EngagementDetail engagementId={fixtures.engagement.id} />);

      expect(await screen.findByRole("button", { name: /Submit verification/i })).toBeDisabled();
      expect(screen.getByText(label, { selector: "dd" })).toBeInTheDocument();
    });
  });

  it("shows error state on failure", async () => {
    const originalError = console.error;
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].includes("Cannot update a component")) {
        return;
      }
      originalError(...args);
    });

    server.use(graphql.query("Engagement", () => HttpResponse.json({ errors: [{ message: "nope" }] })));

    renderWithProviders(<EngagementDetail engagementId="84532:404" />);

    expect(await screen.findAllByText(/Failed to load engagement/i)).not.toHaveLength(0);

    errorSpy.mockRestore();
  });
});
