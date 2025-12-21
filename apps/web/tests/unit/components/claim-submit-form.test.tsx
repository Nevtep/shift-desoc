import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClaimSubmitForm } from "../../../components/claims/claim-submit-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";

vi.mock("../../../lib/contracts", () => {
  return {
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000001", abi: [] })
  };
});

describe("ClaimSubmitForm", () => {
  it("disables submit and shows wallet hint when disconnected", () => {
    mockWagmiHooks({ connected: false });

    renderWithProviders(<ClaimSubmitForm />);

    expect(screen.getByRole("button", { name: /Submit claim/i })).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to submit/i)).toBeInTheDocument();
  });

  it("validates numeric valuable action id", async () => {
    mockWagmiHooks({ connected: true });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<ClaimSubmitForm />);

    await userEvent.clear(screen.getByLabelText(/Valuable Action ID/i));
    await userEvent.type(screen.getByLabelText(/Valuable Action ID/i), "abc");
    await userEvent.type(screen.getByLabelText(/Title/i), "Example title");
    await userEvent.type(screen.getByLabelText(/Description/i), "Example description");
    await userEvent.click(screen.getByRole("button", { name: /Submit claim/i }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/valid valuable action id/i))
    );

    alertSpy.mockRestore();
  });

  it("uploads evidence and shows success on submit", async () => {
    mockWagmiHooks({ connected: true, address: "0x1230000000000000000000000000000000000123" });

    const fetchSpy = vi.spyOn(global, "fetch");

    renderWithProviders(<ClaimSubmitForm />);

    await userEvent.type(screen.getByLabelText(/Valuable Action ID/i), "2");
    await userEvent.type(screen.getByLabelText(/Title/i), "Ship feature");
    await userEvent.type(screen.getByLabelText(/Description/i), "Did the thing");
    await userEvent.type(screen.getByLabelText(/Evidence CIDs/i), "ipfs://cid1,cid2");

    await userEvent.click(screen.getByRole("button", { name: /Submit claim/i }));

    await waitFor(() => expect(screen.getByText(/Claim submitted/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    );

    fetchSpy.mockRestore();
  });
});
