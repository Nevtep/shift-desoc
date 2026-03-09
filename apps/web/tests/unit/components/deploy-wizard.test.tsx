import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { saveSession } from "../../../lib/deploy/session-store";
import { createInitialSession } from "../../../lib/deploy/wizard-machine";
import { mockWagmiHooks, renderWithProviders } from "../utils";

describe("DeployWizard", () => {
  it("renders upfront explanation content", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<DeployWizard />);

    expect(await screen.findByText(/Community Deploy Wizard/i)).toBeInTheDocument();
    expect(
      screen.getByText(/multi-signature sequence: preflight, deploy stack, role wiring, and deterministic verification/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Before you start, this is the full sequence the wizard will execute/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Deploy Community Stack/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start deploy/i })).toBeDisabled();
  });

  it("shows connect-wallet gate when disconnected", async () => {
    mockWagmiHooks({ connected: false });
    renderWithProviders(<DeployWizard />);

    expect(
      await screen.findByText(/Connect a wallet and complete valid deployment configuration before starting/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start deploy/i })).toBeDisabled();
  });

  it("enables start deploy after required configuration is valid", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(<DeployWizard />);

    const startButton = await screen.findByRole("button", { name: /Start deploy/i });
    expect(startButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Community name/i), "Shift Builders");
    await userEvent.type(screen.getByLabelText(/Community description/i), "Community focused on work verification");
    await userEvent.type(
      screen.getByLabelText(/Treasury stable token address/i),
      "0x1234567890abcdef1234567890abcdef12345678"
    );
    await userEvent.type(
      screen.getByLabelText(/Supported tokens/i),
      "0x1234567890abcdef1234567890abcdef12345678"
    );

    expect(startButton).toBeEnabled();
  });

  it("keeps resume deploy actionable for connected wallet", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(<DeployWizard />);

    expect(await screen.findByRole("button", { name: /Resume deploy/i })).toBeEnabled();
  });

  it("restores saved form config when resume deploy is clicked", async () => {
    const deployer = "0xabc1230000000000000000000000000000000000" as const;
    const session = createInitialSession(deployer, 84532);
    session.status = "failed";
    session.deploymentConfig = {
      communityName: "Shift Resume Test",
      communityDescription: "Recovered from session",
      communityMetadataUri: "ipfs://resume-config",
      treasuryVault: "0x1111111111111111111111111111111111111111",
      treasuryStableToken: "0x2222222222222222222222222222222222222222",
      supportedTokensCsv: "0x3333333333333333333333333333333333333333"
    };
    saveSession(session);

    mockWagmiHooks({ connected: true, address: deployer, chainId: 84532 });
    renderWithProviders(<DeployWizard />);

    await userEvent.click(await screen.findByRole("button", { name: /Resume deploy/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Resume deploy|Resuming/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Community name/i)).toHaveValue("Shift Resume Test");
    });
    expect(screen.getByLabelText(/Community description/i)).toHaveValue("Recovered from session");
    expect(screen.getByLabelText(/Community metadata URI/i)).toHaveValue("ipfs://resume-config");
    expect(screen.getByLabelText(/Treasury vault address/i)).toHaveValue("0x1111111111111111111111111111111111111111");
    expect(screen.getByLabelText(/Treasury stable token address/i)).toHaveValue("0x2222222222222222222222222222222222222222");
    expect(screen.getByLabelText(/Supported tokens/i)).toHaveValue("0x3333333333333333333333333333333333333333");
  });
});
