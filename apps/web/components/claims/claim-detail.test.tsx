import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClaimDetail } from "./claim-detail";
import { server } from "../../tests/unit/server";
import { mockWagmiHooks, renderWithProviders } from "../../tests/unit/utils";
import { fixtures } from "../../tests/unit/mocks/fixtures";

describe("ClaimDetail", () => {
  it("renders metadata, evidence, and juror table", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<ClaimDetail claimId={fixtures.claim.id} />);

    expect(await screen.findByText(/Claim 50/i)).toBeInTheDocument();
    expect(screen.getByText(/Evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Juror Panel/i)).toBeInTheDocument();
  });

  it("gates verification when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<ClaimDetail claimId={fixtures.claim.id} />);

    const submit = await screen.findByRole("button", { name: /Submit verification/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to verify/i)).toBeInTheDocument();
  });

  it("shows juror warning when connected but not assigned", async () => {
    mockWagmiHooks({ connected: true, address: "0x9999999999999999999999999999999999999999" });
    renderWithProviders(<ClaimDetail claimId={fixtures.claim.id} />);

    expect(await screen.findByText(/You are not assigned as a juror/i)).toBeInTheDocument();
  });

  it("shows error state on failure", async () => {
    const originalError = console.error;
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].includes("Cannot update a component")) {
        return;
      }
      originalError(...args);
    });

    server.use(graphql.query("Claim", () => HttpResponse.json({ errors: [{ message: "nope" }] })));

    renderWithProviders(<ClaimDetail claimId="404" />);

    expect(await screen.findAllByText(/Failed to load claim/i)).not.toHaveLength(0);

    errorSpy.mockRestore();
  });
});
