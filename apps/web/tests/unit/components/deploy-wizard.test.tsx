import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { mockWagmiHooks, renderWithProviders } from "../utils";

vi.mock("../../../hooks/useMyDeployedCommunities", () => ({
  useMyDeployedCommunities: () => ({
    hasCommunities: false,
    isLoading: false,
    refetch: vi.fn()
  })
}));

vi.mock("../../../hooks/useDeployResume", () => ({
  useDeployResume: () => ({
    resume: vi.fn(),
    error: null
  })
}));

describe("DeployWizard", () => {
  it("shows 5-step progress labels during in-progress deployment", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    renderWithProviders(
      <DeployWizard
        options={{
          stepExecutor: vi.fn(async () => ({})),
          readVerificationSnapshot: vi.fn(async () => ({
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true
          }))
        }}
      />
    );

    const start = await screen.findByRole("button", { name: /^Next$/i });
    expect(screen.getByText(/Wire Registry/i)).toBeInTheDocument();
    expect(screen.getByText(/Handoff/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Community name/i), "Shift Builders");
    expect(start).toBeEnabled();
  });

  it("shows connect-wallet gate when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<DeployWizard />);

    expect(
      await screen.findByText(/Connect your wallet to get started. It's the first step./i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mock/i })).toBeInTheDocument();
  });

  it("enables start deploy after required configuration is valid", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(<DeployWizard />);

    const startButton = await screen.findByRole("button", { name: /^Next$/i });
    expect(startButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Community name/i), "Shift Builders");

    expect(startButton).toBeEnabled();
  });

  it("keeps resume deploy actionable for connected wallet with resumable session", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(
      <DeployWizard
        options={{
          stepExecutor: vi.fn(async () => ({})),
          readVerificationSnapshot: vi.fn(async () => ({
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true
          }))
        }}
      />
    );

    expect(screen.queryByRole("button", { name: /Resume deploy/i })).not.toBeInTheDocument();
  });

  it("renders in-progress deployment heading", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });
    renderWithProviders(
      <DeployWizard
        options={{
          stepExecutor: vi.fn(async () => ({})),
          readVerificationSnapshot: vi.fn(async () => ({
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true
          }))
        }}
      />
    );

    expect(await screen.findByText(/Create your community/i)).toBeInTheDocument();
  });
});
