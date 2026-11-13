import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeployWizard } from "../../../components/home/deploy-wizard";
import { mockWagmiHooks, renderWithProviders } from "../utils";

type Discovery = { hasCommunities: boolean; isLoading: boolean; refetch: () => void };

const store = vi.hoisted(() => {
  let current: Discovery = { hasCommunities: false, isLoading: true, refetch: () => {} };
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next: Discovery) {
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
});

// The hook reads from an external store, so the very same mounted component re-renders when
// discovery resolves (a rerender() with a new tree would remount and hide a state-reset bug).
vi.mock("../../../hooks/useMyDeployedCommunities", async () => {
  const React = await import("react");
  return {
    useMyDeployedCommunities: () => React.useSyncExternalStore(store.subscribe, store.get, store.get)
  };
});

vi.mock("../../../hooks/useDeployResume", () => ({
  useDeployResume: () => ({ resume: vi.fn(), error: null })
}));

function connect() {
  mockWagmiHooks({
    connected: true,
    address: "0xabc1230000000000000000000000000000000000",
    chainId: 84532
  });
}

describe("DeployWizard while community discovery is running", () => {
  beforeEach(() => {
    window.localStorage.clear();
    connect();
    store.set({ hasCommunities: false, isLoading: true, refetch: () => {} });
  });

  it("offers Create community as soon as the wallet is connected, even while discovery is loading", async () => {
    renderWithProviders(<DeployWizard />);

    expect(await screen.findByRole("button", { name: /Create community/i })).toBeTruthy();
  });

  it("opens the wizard while discovery is still loading", async () => {
    renderWithProviders(<DeployWizard />);
    await userEvent.click(await screen.findByRole("button", { name: /Create community/i }));

    expect(await screen.findByText(/Step 1/i)).toBeTruthy();
  });

  it("updates the has-communities hint when discovery resolves", async () => {
    renderWithProviders(<DeployWizard />);
    expect(await screen.findByRole("button", { name: /Create community/i })).toBeTruthy();
    expect(screen.queryByText(/You already have communities/i)).toBeNull();

    act(() => store.set({ hasCommunities: true, isLoading: false, refetch: () => {} }));

    expect(await screen.findByText(/You already have communities/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Create community/i })).toBeTruthy();
  });

  it("keeps an already open wizard intact when discovery resolves later", async () => {
    renderWithProviders(<DeployWizard />);
    await userEvent.click(await screen.findByRole("button", { name: /Create community/i }));
    expect(await screen.findByText(/Step 1/i)).toBeTruthy();

    act(() => store.set({ hasCommunities: true, isLoading: false, refetch: () => {} }));

    expect(screen.getByText(/Step 1/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Create community$/i })).toBeNull();
  });
});
