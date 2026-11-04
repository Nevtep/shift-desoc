import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveSession } from "../../../lib/deploy/session-store";
import { createInitialSession } from "../../../lib/deploy/wizard-machine";
import { mockWagmiHooks, TestWrapper } from "../utils";

const clientState = vi.hoisted(() => {
  const getBlockNumber = vi.fn();
  const getLogs = vi.fn();
  // Stable identity, like the real memoized hook: a new object per render would re-trigger refetch.
  const client = { raw: {}, getBlockNumber, getLogs };
  return { getBlockNumber, getLogs, client };
});

vi.mock("../../../hooks/useCachedPublicClient", () => ({
  useCachedPublicClient: () => clientState.client
}));

vi.mock("../../../lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/contracts")>();
  return {
    ...actual,
    getContractAddress: () => "0x00000000000000000000000000000000000000c1"
  };
});

import {
  DISCOVERY_DEADLINE_MS,
  DISCOVERY_RETRY_DELAYS_MS,
  useMyDeployedCommunities
} from "../../../hooks/useMyDeployedCommunities";

const WALLET = "0xabc1230000000000000000000000000000000000" as const;

function seedCompletedSession(communityId: number) {
  const session = createInitialSession(WALLET, 84532);
  session.status = "completed";
  session.communityId = communityId;
  saveSession(session);
}

describe("useMyDeployedCommunities discovery deadline", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    clientState.getBlockNumber.mockReset().mockResolvedValue(1_000_000n);
    clientState.getLogs.mockReset();
    mockWagmiHooks({ connected: true, address: WALLET, chainId: 84532 });
    seedCompletedSession(7);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deadline is between 8 and 10 seconds", () => {
    expect(DISCOVERY_DEADLINE_MS).toBeGreaterThanOrEqual(8_000);
    expect(DISCOVERY_DEADLINE_MS).toBeLessThanOrEqual(10_000);
  });

  it("stops loading and falls back to the session cache when getLogs hangs", async () => {
    clientState.getLogs.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISCOVERY_DEADLINE_MS - 1_000);
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.communityIds).toEqual([7]);
    expect(result.current.hasCommunities).toBe(true);
  });

  it("stops loading and falls back to the session cache when getLogs is rejected", async () => {
    clientState.getLogs.mockRejectedValue(new Error("HTTP request failed: 403 forbidden"));

    const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.communityIds).toEqual([7]);
  });

  it("stops issuing sequential getLogs requests once the deadline has passed", async () => {
    clientState.getLogs.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 3_000))
    );

    const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISCOVERY_DEADLINE_MS + 1_000);
    });
    expect(result.current.isLoading).toBe(false);
    const callsAtDeadline = clientState.getLogs.mock.calls.length;
    // 20 chunks x 3 s would take 60 s; the deadline must cut that to a handful of requests.
    expect(callsAtDeadline).toBeLessThanOrEqual(4);

    // The cancelled scan must not keep walking its remaining chunks. The only later requests come
    // from the scheduled background retry, which waits DISCOVERY_RETRY_DELAYS_MS[0] after the fallback.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISCOVERY_RETRY_DELAYS_MS[0] - 5_000);
    });
    expect(clientState.getLogs.mock.calls.length).toBe(callsAtDeadline);
  });

  it("merges on-chain results with the session cache when the scan finishes in time", async () => {
    clientState.getLogs.mockResolvedValue([{ args: { communityId: 42n } }]);

    const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.isLoading).toBe(false);
    expect([...result.current.communityIds].sort((a, b) => a - b)).toEqual([7, 42]);
  });

  describe("recovery after the fallback (QA step 4)", () => {
    it("retries in the background and updates the communities without a reload once the RPC recovers", async () => {
      clientState.getLogs
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValue([{ args: { communityId: 42n } }]);

      const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVERY_DEADLINE_MS + 1_000);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.communityIds).toEqual([7]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISCOVERY_RETRY_DELAYS_MS[0] + 100);
      });
      expect([...result.current.communityIds].sort((a, b) => a - b)).toEqual([7, 42]);
      // The retry is silent: it never flips the hook back to loading.
      expect(result.current.isLoading).toBe(false);
    });

    it("keeps the retries bounded when the RPC never recovers", async () => {
      clientState.getLogs.mockRejectedValue(new Error("HTTP request failed: 403 forbidden"));

      renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60 * 1_000);
      });
      // One initial scan plus one per configured retry delay, then it stops.
      expect(clientState.getBlockNumber.mock.calls.length).toBe(1 + DISCOVERY_RETRY_DELAYS_MS.length);
    });

    it("rescans when the browser comes back online", async () => {
      clientState.getLogs.mockRejectedValueOnce(new Error("Failed to fetch"));
      clientState.getLogs.mockResolvedValue([{ args: { communityId: 42n } }]);

      const { result } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.communityIds).toEqual([7]);

      await act(async () => {
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(100);
      });
      expect([...result.current.communityIds].sort((a, b) => a - b)).toEqual([7, 42]);
    });

    it("stops retrying after unmount", async () => {
      clientState.getLogs.mockRejectedValue(new Error("HTTP request failed: 403 forbidden"));

      const { unmount } = renderHook(() => useMyDeployedCommunities(), { wrapper: TestWrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      const callsBefore = clientState.getBlockNumber.mock.calls.length;
      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1_000);
      });
      expect(clientState.getBlockNumber.mock.calls.length).toBe(callsBefore);
    });
  });
});

