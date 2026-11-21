import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { OnboardingConnectStep } from "../../../components/home/onboarding-connect-step";
import { WalletConnect } from "../../../components/wallet/wallet-connect";
import { mockWagmiHooks, renderWithProviders, TestWrapper } from "../utils";
import { setWagmiMockState } from "../mocks/wagmiMock";

vi.mock("../../../hooks/useMyDeployedCommunities", () => ({
  useMyDeployedCommunities: () => ({ hasCommunities: false, isLoading: false, refetch: vi.fn() })
}));

const ADDRESS = "0xabc1230000000000000000000000000000000000" as const;
const ETHEREUM = 1;
const BASE_SEPOLIA = 84532;

describe("Wallet network handling (Rabby connects on Ethereum by default)", () => {
  it("asks the wallet for Base Sepolia when connecting from the onboarding step", async () => {
    const connectSpy = vi.fn();
    mockWagmiHooks({ connected: false });
    setWagmiMockState({ connectSpy });
    render(<OnboardingConnectStep />, { wrapper: TestWrapper });

    await userEvent.click(screen.getByRole("button", { name: "Mock" }));

    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ chainId: BASE_SEPOLIA }));
  });

  it("asks the wallet for Base Sepolia when connecting from the header menu", async () => {
    const connectSpy = vi.fn();
    mockWagmiHooks({ connected: false });
    setWagmiMockState({ connectSpy });
    render(<WalletConnect />, { wrapper: TestWrapper });

    await userEvent.click(await screen.findByRole("button", { name: /Connect Wallet/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mock" }));

    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ chainId: BASE_SEPOLIA }));
  });

  it("header shows the wallet's real network, not the app config network", async () => {
    mockWagmiHooks({ connected: true, address: ADDRESS, chainId: BASE_SEPOLIA });
    setWagmiMockState({ walletChainId: ETHEREUM });
    render(<WalletConnect />, { wrapper: TestWrapper });

    expect(screen.getByText(/Switch to Base Sepolia/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Wallet connected/i }));
    expect(screen.queryByText(/^✓ Base Sepolia$/)).not.toBeInTheDocument();
  });

  it("preflight blocks a wallet on another network and offers the switch", async () => {
    const switchChainSpy = vi.fn();
    mockWagmiHooks({ connected: true, address: ADDRESS, chainId: BASE_SEPOLIA });
    setWagmiMockState({ walletChainId: ETHEREUM, switchChainSpy });
    renderWithProviders(<DeployWizard />);

    await userEvent.click(await screen.findByRole("button", { name: /Create community/i }));
    await userEvent.type(screen.getByLabelText(/Community name/i), "Test Community");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.type(screen.getByLabelText(/^Description$/i), "Test Description");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(screen.getByRole("button", { name: /USDC \(Base Sepolia\)/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(await screen.findByRole("radio", { name: /Admin-managed/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Switch to a supported network\./i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Cambiar la wallet a Base Sepolia/i }));
    expect(switchChainSpy).toHaveBeenCalledWith({ chainId: BASE_SEPOLIA });
  });

  it("does not offer the switch when the wallet is already on Base Sepolia", async () => {
    mockWagmiHooks({ connected: true, address: ADDRESS, chainId: BASE_SEPOLIA });
    renderWithProviders(<DeployWizard />);

    await userEvent.click(await screen.findByRole("button", { name: /Create community/i }));
    await userEvent.type(screen.getByLabelText(/Community name/i), "Test Community");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.type(screen.getByLabelText(/^Description$/i), "Test Description");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(screen.getByRole("button", { name: /USDC \(Base Sepolia\)/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(await screen.findByRole("radio", { name: /Admin-managed/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/All checks passed\. You can deploy\./i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cambiar la wallet a Base Sepolia/i })).not.toBeInTheDocument();
  });
});
