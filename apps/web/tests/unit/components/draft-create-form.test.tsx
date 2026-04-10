import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wagmi from "wagmi";

import { DraftCreateForm } from "../../../components/drafts/draft-create-form";
import { mockWagmiHooks, renderWithProviders } from "../utils";

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
            verifierManager: "0x0000000000000000000000000000000000000202",
            positionManager: "0x0000000000000000000000000000000000000203"
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
    await userEvent.type(screen.getByLabelText(/SBT address/i), "0x0000000000000000000000000000000000001234");
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

  it("shows disabled expert targets for missing module and zero allowlisted functions", () => {
    mockWagmiHooks({ connected: true });

    renderWithProviders(<DraftCreateForm mode="expert" />);

    expect(screen.getAllByText(/Module not configured for this community/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No timelock-allowlisted functions available/i).length).toBeGreaterThan(0);
  });

  it("blocks adding expert action when bytes32 input is empty", async () => {
    mockWagmiHooks({ connected: true });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<DraftCreateForm mode="expert" />);

    await userEvent.selectOptions(screen.getByLabelText(/Target contract/i), "positionManager");
    await userEvent.selectOptions(screen.getByLabelText(/Action signature/i), "definePositionType(bytes32,uint32,bool)");
    await userEvent.type(screen.getByLabelText(/points \(uint32\)/i), "10");
    await userEvent.type(screen.getByLabelText(/active \(bool\)/i), "true");

    await userEvent.click(screen.getByRole("button", { name: /Add action/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Missing value.*bytes32/i));
    expect(screen.getByText(/Actions queued \(0\)/i)).toBeInTheDocument();

    alertSpy.mockRestore();
  });

  it("keeps queue visible for empty and non-empty states", async () => {
    mockWagmiHooks({ connected: true });

    renderWithProviders(<DraftCreateForm />);

    expect(screen.getByText(/Actions queued \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Queue is empty/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/SBT address/i), "0x0000000000000000000000000000000000001234");
    await userEvent.click(screen.getByRole("button", { name: /Add guided action/i }));

    expect(screen.getByText(/Actions queued \(1\)/i)).toBeInTheDocument();
  });

  it("renders with fixed community and legacy props without migration", () => {
    mockWagmiHooks({ connected: true });

    renderWithProviders(<DraftCreateForm fixedCommunityId={3} initialRequestId={0} />);

    expect(screen.getByRole("heading", { name: /Create Draft/i })).toBeInTheDocument();
    expect(screen.getByText(/Community #3/i)).toBeInTheDocument();
  });
});
