import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RequestCreateForm } from "../../../components/requests/request-create-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";

vi.mock("../../../lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/contracts")>();
  return {
    ...actual,
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000003", abi: [] })
  };
});

vi.mock("../../../hooks/useCommunityModules", () => {
  return {
    useCommunityModules: () => ({
      modules: {
        requestHub: "0x0000000000000000000000000000000000000006",
        valuableActionRegistry: "0x0000000000000000000000000000000000000009"
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null
    }),
    COMMUNITY_MODULE_ABIS: {
      requestHub: [],
      valuableActionRegistry: []
    }
  };
});

describe("RequestCreateForm", () => {
  it("requires title and content", async () => {
    mockWagmiHooks({ connected: true });

    renderWithProviders(<RequestCreateForm />);

    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Title \/ Content/i)).toBeInTheDocument();
  });

  it("submits request and shows success", async () => {
    mockWagmiHooks({ connected: true, address: "0x5550000000000000000000000000000000000555" });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ cid: "mock-cid" })
    } as Response);

    renderWithProviders(<RequestCreateForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "3");
    await userEvent.click(screen.getByRole("button", { name: /Next/i }));

    await userEvent.type(screen.getByRole("textbox", { name: /^Title$/i }), "New request");
    await userEvent.type(screen.getByRole("textbox", { name: /Tags/i }), "governance, core");
    await userEvent.type(
      screen.getByRole("textbox", { name: /Content \(markdown\)/i }),
      "## Need\n\nBuild the feature."
    );

    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    await userEvent.click(screen.getByRole("button", { name: /Submit request/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    ));
    expect(await screen.findByText(/Request created/i)).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
