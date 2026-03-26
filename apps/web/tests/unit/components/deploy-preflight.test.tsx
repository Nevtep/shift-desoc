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

describe("Deploy preflight gating", () => {
  it("auto-loads and displays shared infra details", async () => {
    mockWagmiHooks({ connected: true, chainId: 84532, address: "0xabc1230000000000000000000000000000000000" });
    renderWithProviders(<DeployWizard />);

    await userEvent.type(screen.getByLabelText(/Community name/i), "Test Community");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    await userEvent.type(screen.getByLabelText(/Community description/i), "Test Description");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    await userEvent.click(screen.getByRole("button", { name: /USDC \(Base Sepolia\)/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Preflight check/i)).toBeInTheDocument();
    expect(await screen.findByText(/All checks passed\. You can deploy\./i)).toBeInTheDocument();
    expect(screen.getByText(/Wallet:/i)).toBeInTheDocument();
    expect(screen.getByText(/Network:/i)).toBeInTheDocument();
  });

  it("renders blocked states when network/funds fail", async () => {
    mockWagmiHooks({ connected: true, chainId: 1, address: "0xabc1230000000000000000000000000000000000" });
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

    await userEvent.type(screen.getByLabelText(/Community name/i), "Test Community");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    await userEvent.type(screen.getByLabelText(/Community description/i), "Test Description");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    await userEvent.click(screen.getByRole("button", { name: /USDC \(Base Sepolia\)/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Switch to a supported network/i)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient native token balance for estimated deployment cost/i)).toBeInTheDocument();
  });
});
