import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { mockWagmiHooks, renderWithProviders } from "../utils";

describe("Deploy preflight gating", () => {
  it("auto-loads and displays shared infra details", async () => {
    mockWagmiHooks({ connected: true, chainId: 84532, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(<DeployWizard />);

    expect(await screen.findByText(/Shared infra details/i)).toBeInTheDocument();
    expect(screen.getByText(/AccessManager:/i)).toBeInTheDocument();
    expect(screen.getByText(/ParamController:/i)).toBeInTheDocument();
    expect(screen.getByText(/CommunityRegistry:/i)).toBeInTheDocument();
  });

  it("renders blocked states when wallet/network/shared infra/funds fail", async () => {
    mockWagmiHooks({ connected: false, chainId: 1 });
    renderWithProviders(
      <DeployWizard
        options={{
          supportedChainIds: [84532],
          estimateInput: {
            estimatedTxCount: 999,
            estimatedGasPerTx: 1_000_000n,
            maxFeePerGasWei: 100_000_000_000n,
            currentBalanceWei: 1n
          }
        }}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: /Run preflight/i }));
    expect(await screen.findByText(/Connect wallet to start deployment/i)).toBeInTheDocument();
    expect(screen.getByText(/Switch to a supported network/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared infrastructure is missing or invalid/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Connect a wallet and complete valid deployment configuration before starting/i)
    ).toBeInTheDocument();
  });
});
