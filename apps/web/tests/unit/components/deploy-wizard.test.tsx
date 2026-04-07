import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { mockWagmiHooks, renderWithProviders } from "../utils";

const { resumeMock } = vi.hoisted(() => ({
  resumeMock: vi.fn()
}));

vi.mock("../../../hooks/useMyDeployedCommunities", () => ({
  useMyDeployedCommunities: () => ({
    hasCommunities: false,
    isLoading: false,
    refetch: vi.fn()
  })
}));

vi.mock("../../../hooks/useDeployResume", () => ({
  useDeployResume: () => ({
    resume: resumeMock,
    error: null
  })
}));

describe("DeployWizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resumeMock.mockReset();
    resumeMock.mockResolvedValue(null);
  });

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

  it("shows resume deployment button for hydrated in-progress session", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const storedSession = {
      sessionId: "0xabc1230000000000000000000000000000000000-recovered-2",
      deployerAddress: "0xabc1230000000000000000000000000000000000",
      chainId: 84532,
      communityId: 2,
      targetType: "registered",
      status: "in-progress",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          key: "PRECHECKS",
          name: "Preflight",
          purpose: "Validate wallet, network, shared infra, and funds before writes.",
          status: "succeeded",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "DEPLOY_STACK",
          name: "Deploy Contract Layers",
          purpose: "Deploy community AccessManager, then governance, verification, economic, commerce, and coordination bytecode via shared layer factories.",
          status: "pending",
          expectedTxCount: 7,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "CONFIGURE_ACCESS_PERMISSIONS",
          name: "Wire Registry And Permissions",
          purpose: "Bootstrap registry wiring and apply access roles. Additional setup transactions may run if defaults are missing.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "HANDOFF_ADMIN_TO_TIMELOCK",
          name: "Handoff Admin To Timelock",
          purpose: "Transfer admin authority from bootstrap wallet to timelock governance.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "VERIFY_DEPLOYMENT",
          name: "Verify Community Deployment",
          purpose: "Run deterministic script-parity checks.",
          status: "pending",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        }
      ]
    };

    window.localStorage.setItem(
      "shift.manager.deploy.sessions.v1",
      JSON.stringify({ [storedSession.sessionId]: storedSession })
    );

    renderWithProviders(<DeployWizard />);

    expect(await screen.findByRole("button", { name: /Resume deployment/i })).toBeInTheDocument();
  });

  it("shows resume deployment button when bootstrap failed before communityId assignment", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const failedSession = {
      sessionId: "0xabc1230000000000000000000000000000000000-recovered-no-community",
      deployerAddress: "0xabc1230000000000000000000000000000000000",
      chainId: 84532,
      targetType: "registered",
      status: "failed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          key: "PRECHECKS",
          name: "Preflight",
          purpose: "Validate wallet, network, shared infra, and funds before writes.",
          status: "succeeded",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "DEPLOY_STACK",
          name: "Deploy Contract Layers",
          purpose: "Deploy community AccessManager, then governance, verification, economic, commerce, and coordination bytecode via shared layer factories.",
          status: "succeeded",
          expectedTxCount: 7,
          confirmedTxCount: 7,
          txHashes: [
            "0x1111111111111111111111111111111111111111111111111111111111111111"
          ]
        },
        {
          key: "CONFIGURE_ACCESS_PERMISSIONS",
          name: "Wire Registry And Permissions",
          purpose: "Bootstrap registry wiring and apply access roles. Additional setup transactions may run if defaults are missing.",
          status: "failed",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: [],
          failureReason: "bootstrapCommunity reverted"
        },
        {
          key: "HANDOFF_ADMIN_TO_TIMELOCK",
          name: "Handoff Admin To Timelock",
          purpose: "Transfer admin authority from bootstrap wallet to timelock governance.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "VERIFY_DEPLOYMENT",
          name: "Verify Community Deployment",
          purpose: "Run deterministic script-parity checks.",
          status: "pending",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        }
      ]
    };

    window.localStorage.setItem(
      "shift.manager.deploy.sessions.v1",
      JSON.stringify({ [failedSession.sessionId]: failedSession })
    );

    renderWithProviders(<DeployWizard />);

    expect(await screen.findByRole("button", { name: /Resume deployment/i })).toBeInTheDocument();
  });

  it("redirects to currency step with guidance when resumed config is missing treasury token fields", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const storedSession = {
      sessionId: "0xabc1230000000000000000000000000000000000-recovered-2",
      deployerAddress: "0xabc1230000000000000000000000000000000000",
      chainId: 84532,
      communityId: 2,
      targetType: "registered",
      status: "in-progress",
      deploymentConfig: {
        communityName: "Recovered",
        communityDescription: "Recovered description",
        communityMetadataUri: "",
        treasuryVault: "0x1111111111111111111111111111111111111111",
        treasuryStableToken: "",
        supportedTokensCsv: ""
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          key: "PRECHECKS",
          name: "Preflight",
          purpose: "Validate wallet, network, shared infra, and funds before writes.",
          status: "succeeded",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "DEPLOY_STACK",
          name: "Deploy Contract Layers",
          purpose: "Deploy community AccessManager, then governance, verification, economic, commerce, and coordination bytecode via shared layer factories.",
          status: "pending",
          expectedTxCount: 7,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "CONFIGURE_ACCESS_PERMISSIONS",
          name: "Wire Registry And Permissions",
          purpose: "Bootstrap registry wiring and apply access roles. Additional setup transactions may run if defaults are missing.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "HANDOFF_ADMIN_TO_TIMELOCK",
          name: "Handoff Admin To Timelock",
          purpose: "Transfer admin authority from bootstrap wallet to timelock governance.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "VERIFY_DEPLOYMENT",
          name: "Verify Community Deployment",
          purpose: "Run deterministic script-parity checks.",
          status: "pending",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        }
      ]
    };

    window.localStorage.setItem(
      "shift.manager.deploy.sessions.v1",
      JSON.stringify({ [storedSession.sessionId]: storedSession })
    );

    resumeMock.mockResolvedValue(storedSession);

    renderWithProviders(<DeployWizard />);

    await userEvent.click(await screen.findByRole("button", { name: /Resume deployment/i }));

    expect(
      await screen.findByText(/Resume needs treasury token settings/i)
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Currency" })).toBeInTheDocument();
  });

  it("does not force config step when resumed config has non-missing validation errors", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const storedSession = {
      sessionId: "0xabc1230000000000000000000000000000000000-recovered-3",
      deployerAddress: "0xabc1230000000000000000000000000000000000",
      chainId: 84532,
      communityId: 3,
      targetType: "registered",
      status: "in-progress",
      deploymentConfig: {
        communityName: "Recovered",
        communityDescription: "Recovered description",
        communityMetadataUri: "",
        treasuryVault: "0x1111111111111111111111111111111111111111",
        treasuryStableToken: "0xnotAnAddress",
        supportedTokensCsv: "0xnotAnAddress"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          key: "PRECHECKS",
          name: "Preflight",
          purpose: "Validate wallet, network, shared infra, and funds before writes.",
          status: "succeeded",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "DEPLOY_STACK",
          name: "Deploy Contract Layers",
          purpose: "Deploy community AccessManager, then governance, verification, economic, commerce, and coordination bytecode via shared layer factories.",
          status: "pending",
          expectedTxCount: 7,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "CONFIGURE_ACCESS_PERMISSIONS",
          name: "Wire Registry And Permissions",
          purpose: "Bootstrap registry wiring and apply access roles. Additional setup transactions may run if defaults are missing.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "HANDOFF_ADMIN_TO_TIMELOCK",
          name: "Handoff Admin To Timelock",
          purpose: "Transfer admin authority from bootstrap wallet to timelock governance.",
          status: "pending",
          expectedTxCount: 2,
          confirmedTxCount: 0,
          txHashes: []
        },
        {
          key: "VERIFY_DEPLOYMENT",
          name: "Verify Community Deployment",
          purpose: "Run deterministic script-parity checks.",
          status: "pending",
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: []
        }
      ]
    };

    window.localStorage.setItem(
      "shift.manager.deploy.sessions.v1",
      JSON.stringify({ [storedSession.sessionId]: storedSession })
    );

    resumeMock.mockResolvedValue(storedSession);

    renderWithProviders(<DeployWizard />);

    await userEvent.click(await screen.findByRole("button", { name: /Resume deployment/i }));

    expect(screen.queryByText(/Resume needs/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Currency" })).not.toBeInTheDocument();
  });
});
