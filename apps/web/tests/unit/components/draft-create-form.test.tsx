import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wagmi from "wagmi";

import { DraftCreateForm } from "../../../components/drafts/draft-create-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";

vi.mock("../../../lib/contracts", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/contracts")>("../../../lib/contracts");
  return {
    ...actual,
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000002", abi: [] })
  };
});

describe("DraftCreateForm", () => {
  beforeEach(() => {
    vi.spyOn(wagmi, "useReadContract").mockImplementation((config: any) => {
      if (config?.functionName === "getCommunityModules") {
        return {
          data: {
            draftsManager: "0x0000000000000000000000000000000000000200",
            valuableActionRegistry: "0x0000000000000000000000000000000000000201",
            requestHub: "0x0000000000000000000000000000000000000202"
          },
          isLoading: false,
          isError: false
        } as any;
      }

      return {
        data: undefined,
        isLoading: false,
        isError: false
      } as any;
    });
  });

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
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<DraftCreateForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "2");
    await userEvent.clear(screen.getByLabelText(/Request ID/i));
    await userEvent.type(screen.getByLabelText(/Request ID/i), "0");
    await userEvent.type(screen.getByLabelText(/Draft content/i), "## Draft body");
    await userEvent.type(screen.getByLabelText(/Action title/i), "Weekly moderation sweep");
    await userEvent.click(screen.getByRole("button", { name: /Add guided action/i }));

    await userEvent.click(screen.getByRole("button", { name: /Create draft/i }));

    await waitFor(() => expect(screen.getByText(/surface after the indexer updates/i)).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    );

    alertSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});
