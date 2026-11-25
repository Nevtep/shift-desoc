import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ readContract: null as unknown as (a: any) => Promise<unknown> }));

vi.mock("wagmi", () => ({ useChainId: () => 84532 }));
vi.mock("../../../lib/contracts", () => ({
  getContractConfig: () => ({ address: "0x00000000000000000000000000000000000000aa", abi: [] })
}));
vi.mock("../../../hooks/useCachedPublicClient", () => ({
  useCachedPublicClient: () => ({ raw: {}, readContract: (a: any) => state.readContract(a) })
}));

import { useCommunityName } from "../../../hooks/useCommunityName";

describe("useCommunityName", () => {
  beforeEach(() => {
    state.readContract = async () => ({ name: "Huerto del Barrio", active: true });
  });

  it("reads the name from the CommunityRegistry contract", async () => {
    const { result } = renderHook(() => useCommunityName(11));
    await waitFor(() => expect(result.current).toBe("Huerto del Barrio"));
  });

  it("returns null when the read fails so the page falls back to the numeric label", async () => {
    state.readContract = async () => {
      throw new Error("rpc down");
    };
    const { result } = renderHook(() => useCommunityName(11));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });
});
