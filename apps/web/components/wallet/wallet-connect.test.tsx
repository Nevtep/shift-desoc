import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WalletConnect } from "./wallet-connect";
import { mockWagmiHooks, TestWrapper } from "../../tests/unit/utils";

const BASE_SEPOLIA_ID = 84532;

describe("WalletConnect", () => {
  it("shows Connect Wallet button and connectors in dropdown when disconnected", async () => {
    mockWagmiHooks({ connected: false });

    render(<WalletConnect />, { wrapper: TestWrapper });

    const connectBtn = await screen.findByRole("button", { name: /Connect Wallet/i });
    expect(connectBtn).toBeInTheDocument();

    await userEvent.click(connectBtn);
    expect(screen.getByRole("menuitem", { name: "Mock" })).toBeInTheDocument();
  });

  it("shows wallet icon button and dropdown with chain controls when connected", async () => {
    mockWagmiHooks({ connected: true, address: "0x000000000000000000000000000000000000bEEF", chainId: BASE_SEPOLIA_ID });

    render(<WalletConnect />, { wrapper: TestWrapper });

    const walletBtn = screen.getByRole("button", { name: /Wallet connected/i });
    expect(walletBtn).toBeInTheDocument();

    await userEvent.click(walletBtn);

    expect(screen.getByText(/Base Sepolia/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disconnect/i })).toBeInTheDocument();
  });
});
