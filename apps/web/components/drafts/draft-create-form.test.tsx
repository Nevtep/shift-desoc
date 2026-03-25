import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wagmi from "wagmi";

import { renderWithProviders, mockWagmiHooks } from "../../tests/unit/utils";
import { DraftCreateForm } from "./draft-create-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: pushMock,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn()
    }),
    usePathname: () => "",
    useSearchParams: () => new URLSearchParams()
  };
});

vi.mock("../../lib/contracts", async () => {
  const actual = await vi.importActual<typeof import("../../lib/contracts")>("../../lib/contracts");
  return {
    ...actual,
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000101", abi: [] })
  };
});

describe("DraftCreateForm scoped route behavior", () => {
  beforeEach(() => {
    mockWagmiHooks({ connected: true, address: "0x9990000000000000000000000000000000000999" });
    pushMock.mockReset();

    vi.spyOn(wagmi, "useReadContract").mockImplementation((config: any) => {
      if (config?.functionName === "getCommunityModules") {
        return {
          data: {
            draftsManager: "0x0000000000000000000000000000000000000200"
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

  it("shows route-derived fixed community as read-only", () => {
    renderWithProviders(<DraftCreateForm fixedCommunityId={6} />);

    expect(screen.getByText("Community #6")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("6")).toBeNull();
  });

  it("redirects to provided scoped path after successful submit", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ cid: "draft-cid" })
    } as Response);

    renderWithProviders(
      <DraftCreateForm fixedCommunityId={6} successRedirectHref="/communities/6/coordination/drafts" />
    );

    await userEvent.clear(screen.getByLabelText(/request id/i));
    await userEvent.type(screen.getByLabelText(/request id/i), "0");
    await userEvent.type(screen.getByLabelText(/draft content/i), "## Draft body");
    await userEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/communities/6/coordination/drafts");
    });

    fetchSpy.mockRestore();
  });
});