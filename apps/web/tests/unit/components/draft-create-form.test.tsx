import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DraftCreateForm } from "../../../components/drafts/draft-create-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";

vi.mock("../../../lib/contracts", () => {
  return {
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000002", abi: [] })
  };
});

describe("DraftCreateForm", () => {
  it("requires either content or an existing CID", async () => {
    mockWagmiHooks({ connected: true });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<DraftCreateForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "1");
    await userEvent.clear(screen.getByLabelText(/Request ID/i));
    await userEvent.type(screen.getByLabelText(/Request ID/i), "0");

    await userEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Provide content/i));

    alertSpy.mockRestore();
  });

  it("uploads content when no CID provided and shows success", async () => {
    mockWagmiHooks({ connected: true, address: "0x9990000000000000000000000000000000000999" });
    const fetchSpy = vi.spyOn(global, "fetch");

    renderWithProviders(<DraftCreateForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "2");
    await userEvent.clear(screen.getByLabelText(/Request ID/i));
    await userEvent.type(screen.getByLabelText(/Request ID/i), "0");
    await userEvent.type(screen.getByLabelText(/Draft content/i), "## Draft body");
    await userEvent.type(screen.getByLabelText(/Targets/i), "0xabc");
    await userEvent.type(screen.getByLabelText(/Values in wei/i), "0");
    await userEvent.type(screen.getByLabelText(/Calldatas hex/i), "0x00");

    await userEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    await waitFor(() => expect(screen.getByText(/Draft created/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    );

    fetchSpy.mockRestore();
  });
});
