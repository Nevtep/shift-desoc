import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessSummary } from "../../../components/communities/overview/access-summary";
import { ACCESS_WIRING_CHECKS } from "../../../lib/community-overview/access-inspection";
import { selectorFromSignature } from "../../../lib/actions/permission-matrix";
import { moduleKeyForTarget } from "../../../lib/community-overview/access-inspection";
import type { CommunityModules } from "../../../hooks/useCommunityModules";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;

function buildModules(accessManager: number, timelock: number): CommunityModules {
  const m: Record<string, `0x${string}`> = { accessManager: addr(accessManager), timelock: addr(timelock), engagementsManager: addr(9) };
  let i = 100;
  for (const c of ACCESS_WIRING_CHECKS) if (c.targetKey !== "engagements") m[c.targetKey] ??= addr(i++);
  return m as CommunityModules;
}

function boundRole(m: CommunityModules, args: readonly unknown[]): bigint {
  const check = ACCESS_WIRING_CHECKS.find(
    (c) => (m as any)[moduleKeyForTarget(c.targetKey)] === args[0] && selectorFromSignature(c.signature) === args[1]
  )!;
  return check.role === "ADMIN" ? 0n : BigInt(check.role);
}

const state = vi.hoisted(() => ({
  modules: null as unknown,
  modulesLoading: false,
  readContract: null as unknown as (a: any) => Promise<unknown>,
  indexerState: "synced" as string
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ status: "disconnected", address: undefined }),
  useChainId: () => 84532
}));
vi.mock("../../../hooks/useCommunityModules", () => ({
  useCommunityModules: () => ({ modules: state.modules, isLoading: state.modulesLoading })
}));
const client = vi.hoisted(() => ({
  raw: {},
  getBytecode: async () => "0x1",
  readContract: (a: any) => (state as any).readContract(a)
}));
vi.mock("../../../hooks/useCachedPublicClient", () => ({ useCachedPublicClient: () => client }));
vi.mock("../../../hooks/useIndexerHealth", () => ({
  useIndexerHealth: () => ({ state: state.indexerState, isLoading: false, isError: state.indexerState === "error", refetch: async () => {} })
}));

import { useCommunityOverview } from "../../../hooks/useCommunityOverview";

describe("useCommunityOverview access reads", () => {
  beforeEach(() => {
    state.indexerState = "synced";
    state.modulesLoading = false;
  });

  it("is checking, never verified, while a new community's modules are still loading", async () => {
    const m = buildModules(1, 2);
    state.modules = m;
    state.readContract = async (a: any) => {
      if (a.functionName === "ADMIN_ROLE") return 0n;
      if (a.functionName === "hasRole") return [a.args[1] === m.timelock, 0];
      if (a.functionName === "getTargetFunctionRole") return boundRole(m, a.args);
      throw new Error("params unavailable");
    };
    const { result, rerender } = renderHook(({ id }) => useCommunityOverview(id), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current.accessLoading).toBe(false));
    expect(result.current.accessInspection.overall).toBe("pass");

    // Switch community: the modules lookup is pending and the previous (identical) modules
    // object is still what the module hook would hand out if it did not drop it. Reads taken
    // for community 1 must not be reused for community 2.
    state.modulesLoading = true;
    rerender({ id: 2 });
    expect(result.current.accessLoading).toBe(true);
    expect(result.current.accessInspection.overall).not.toBe("pass");
  });

  it("never exposes the previous modules' reads while new modules are being read", async () => {
    const modulesA = buildModules(1, 2);
    const modulesB = buildModules(3, 4);
    const roleOf = (fn: string, a: any, m: CommunityModules) => {
      if (fn === "ADMIN_ROLE") return 0n;
      if (fn === "hasRole") return [a.args[1] === m.timelock, 0];
      return boundRole(m, a.args);
    };
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    state.modules = modulesA;
    state.readContract = async (a: any) => {
      if (a.address === modulesB.accessManager) await gate;
      if (a.functionName === "ADMIN_ROLE" || a.functionName === "hasRole" || a.functionName === "getTargetFunctionRole") {
        return roleOf(a.functionName, a, a.address === modulesB.accessManager ? modulesB : modulesA);
      }
      throw new Error("params unavailable");
    };

    const { result, rerender } = renderHook(() => useCommunityOverview(1));
    await waitFor(() => expect(result.current.accessLoading).toBe(false));
    expect(result.current.accessInspection.overall).toBe("pass");

    state.modules = modulesB;
    rerender();
    // Reads for modulesB are pending: the section is "checking" and A's passing reads are not reused.
    expect(result.current.accessLoading).toBe(true);
    expect(result.current.accessInspection.overall).toBe("unavailable");

    await act(async () => release());
    await waitFor(() => expect(result.current.accessLoading).toBe(false));
    expect(result.current.accessInspection.overall).toBe("pass");
    expect(result.current.accessInspection.holders.find((h) => h.key === "timelock")?.address).toBe(modulesB.timelock);
  });

  it.each(["error", "lagging", "unknown"])("keeps chain-derived access signals when the indexer is %s", async (health) => {
    state.indexerState = health;
    const m = buildModules(1, 2);
    state.modules = m;
    state.readContract = async (a: any) => {
      if (a.functionName === "ADMIN_ROLE") return 0n;
      if (a.functionName === "hasRole") return [a.args[1] === m.timelock, 0];
      if (a.functionName === "getTargetFunctionRole") {
        return boundRole(m, a.args);
      }
      throw new Error("params unavailable");
    };
    const { result } = renderHook(() => useCommunityOverview(1));
    await waitFor(() => expect(result.current.accessLoading).toBe(false));

    render(<AccessSummary inspection={result.current.accessInspection} loading={result.current.accessLoading} />);
    expect(result.current.indexer.state).toBe(health);
    expect(screen.getByTestId("access-overall")).toHaveTextContent("verified");
    expect(screen.getByTestId("access-holder-timelock")).toHaveTextContent("holds ADMIN");
    expect(screen.getByTestId("access-holder-bootstrapCoordinator")).toHaveTextContent("not checked");
  });
});
