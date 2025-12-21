import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WalletConnect } from "./wallet-connect";
import { mockWagmiHooks, TestWrapper } from "../../tests/unit/utils";

const BASE_SEPOLIA_ID = 84532;

describe("WalletConnect", () => {
  it("shows connectors when disconnected", async () => {
    mockWagmiHooks({ connected: false });

    render(<WalletConnect />, { wrapper: TestWrapper });

    expect(await screen.findByRole("button", { name: /Connect Mock/i })).toBeInTheDocument();
  });

  it("renders active chain controls when connected", async () => {
    mockWagmiHooks({ connected: true, address: "0x000000000000000000000000000000000000bEEF", chainId: BASE_SEPOLIA_ID });

    render(<WalletConnect />, { wrapper: TestWrapper });

    expect(await screen.findByText(/Base Sepolia/i)).toBeInTheDocument();
    expect(screen.getByText(/0x0000...bEEF/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Base" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Disconnect/i })).toBeInTheDocument();
  });
});
