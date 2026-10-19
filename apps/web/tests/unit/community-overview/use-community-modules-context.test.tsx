import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ZERO = "0x0000000000000000000000000000000000000000";
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;

const state = vi.hoisted(() => ({
  reads: new Map<number, { promise: Promise<unknown>; resolve: (v: unknown) => void }>()
}));

const client = vi.hoisted(() => ({
  raw: {},
  readContract: (args: { args: readonly bigint[] }) => {
    const id = Number(args.args[0]);
    let entry = state.reads.get(id);
    if (!entry) {
      let resolve!: (v: unknown) => void;
      const promise = new Promise((r) => (resolve = r));
      entry = { promise, resolve };
      state.reads.set(id, entry);
    }
    return entry.promise;
  }
}));
vi.mock("../../../hooks/useCachedPublicClient", () => ({ useCachedPublicClient: () => client }));

import { useCommunityModules } from "../../../hooks/useCommunityModules";

function moduleTuple(seed: number) {
  // getCommunityModules returns 26 addresses in struct order; only identity matters here.
  return Array.from({ length: 26 }, (_, i) => (i === 0 ? addr(seed) : ZERO));
}

describe("useCommunityModules context binding", () => {
  beforeEach(() => state.reads.clear());

  it("drops the previous community's modules while the next community is loading", async () => {
    const { result, rerender } = renderHook(({ id, chain }) => useCommunityModules({ communityId: id, chainId: chain }), {
      initialProps: { id: 1, chain: 84532 }
    });

    await waitFor(() => expect(state.reads.has(1)).toBe(true));
    await act(async () => state.reads.get(1)!.resolve(moduleTuple(0xa1)));
    await waitFor(() => expect(result.current.modules?.accessManager).toBe(addr(0xa1)));

    // Switch community: lookup for #2 is pending. Community #1's modules must not be exposed.
    rerender({ id: 2, chain: 84532 });
    expect(result.current.modules).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(state.reads.has(2)).toBe(true));
    await act(async () => state.reads.get(2)!.resolve(moduleTuple(0xb2)));
    await waitFor(() => expect(result.current.modules?.accessManager).toBe(addr(0xb2)));
  });

  it("drops the previous modules when only the chain changes", async () => {
    const { result, rerender } = renderHook(({ id, chain }) => useCommunityModules({ communityId: id, chainId: chain }), {
      initialProps: { id: 1, chain: 84532 }
    });
    await waitFor(() => expect(state.reads.has(1)).toBe(true));
    await act(async () => state.reads.get(1)!.resolve(moduleTuple(0xa1)));
    await waitFor(() => expect(result.current.modules).not.toBeNull());

    rerender({ id: 1, chain: 8453 });
    expect(result.current.modules).toBeNull();
  });
});
