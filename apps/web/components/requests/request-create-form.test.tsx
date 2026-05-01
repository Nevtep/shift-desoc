import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, mockWagmiHooks } from "../../tests/unit/utils";
import { RequestCreateForm } from "./request-create-form";

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

vi.mock("../../hooks/useCommunityModules", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useCommunityModules")>(
    "../../hooks/useCommunityModules"
  );
  return {
    ...actual,
    useCommunityModules: () => ({
      modules: {
        requestHub: "0x0000000000000000000000000000000000000100"
      },
      isFetching: false
    })
  };
});

describe("RequestCreateForm scoped route behavior", () => {
  beforeEach(() => {
    mockWagmiHooks({ connected: true, address: "0x5550000000000000000000000000000000000555" });
    pushMock.mockReset();
  });

  it("shows route-derived fixed community as read-only", () => {
    renderWithProviders(<RequestCreateForm fixedCommunityId={7} />);

    expect(screen.getByText(/#7/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("1")).toBeNull();
  });

  it("redirects to provided scoped path after successful submit", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ cid: "mock-cid" })
    } as Response);

    renderWithProviders(
      <RequestCreateForm
        fixedCommunityId={7}
        successRedirectHref="/communities/7/coordination/requests"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await userEvent.type(screen.getByRole("textbox", { name: /^Title$/i }), "New request");
    await userEvent.type(screen.getByRole("textbox", { name: /content \(markdown\)/i }), "Request body");

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/communities/7/coordination/requests");
    });

    fetchSpy.mockRestore();
  });
});
