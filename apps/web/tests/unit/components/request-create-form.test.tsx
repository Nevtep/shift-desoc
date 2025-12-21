import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RequestCreateForm } from "../../../components/requests/request-create-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";

vi.mock("../../../lib/contracts", () => {
  return {
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000003", abi: [] })
  };
});

describe("RequestCreateForm", () => {
  it("requires title and content", async () => {
    mockWagmiHooks({ connected: true });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<RequestCreateForm />);

    await userEvent.type(screen.getByLabelText(/Community ID/i), "1");
    await userEvent.type(screen.getByLabelText(/^Title$/i), " ");
    await userEvent.type(screen.getByLabelText(/Content/i), " ");
    await userEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Title and content are required/i))
    );

    alertSpy.mockRestore();
  });

  it("submits request and shows success", async () => {
    mockWagmiHooks({ connected: true, address: "0x5550000000000000000000000000000000000555" });
    const fetchSpy = vi.spyOn(global, "fetch");

    renderWithProviders(<RequestCreateForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "3");
    await userEvent.type(screen.getByLabelText(/Tags/i), "governance,core");
    await userEvent.type(screen.getByLabelText(/^Title$/i), "New request");
    await userEvent.type(screen.getByLabelText(/Content/i), "Need to build feature");

    await userEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() => expect(screen.getByText(/Request submitted on-chain/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    );

    fetchSpy.mockRestore();
  });
});
