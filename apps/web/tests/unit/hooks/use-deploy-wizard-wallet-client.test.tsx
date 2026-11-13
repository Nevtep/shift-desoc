import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setWagmiMockState } from "../mocks/wagmiMock";
import { mockWagmiHooks, TestWrapper } from "../utils";

const executorParams: any[] = [];

vi.mock("../../../lib/deploy/factory-step-executor", () => ({
  createFactoryDeployStepExecutor: (params: any) => {
    executorParams.push(params);
    return async () => ({});
  }
}));

vi.mock("../../../lib/deploy/preflight", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/deploy/preflight")>(
    "../../../lib/deploy/preflight"
  );
  return {
    ...actual,
    probeSharedInfra: async () => ({}),
    buildPreflightAssessment: () => ({
      walletConnected: true,
      supportedNetwork: true,
      blockingReasons: [],
      sharedInfra: { isUsable: true },
      funding: { isSufficient: true }
    })
  };
});

import { useDeployWizard } from "../../../hooks/useDeployWizard";

function validConfig() {
  return {
    communityName: "Shift Wizard Deployment",
    communityDescription: "Deployment from manager wizard",
    communityMetadataUri: "",
    treasuryVault: "0x1111111111111111111111111111111111111111",
    treasuryStableToken: "0x2222222222222222222222222222222222222222",
    supportedTokensCsv: "0x2222222222222222222222222222222222222222"
  };
}

const laterDeploy = vi.fn(async () => "0xaaaa" as `0x${string}`);

describe("useDeployWizard wallet deploy client resolution", () => {
  beforeEach(() => {
    executorParams.length = 0;
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => store.clear()
      }
    });
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });
  });

  it("uses a wallet client that resolved after run was created", async () => {
    setWagmiMockState({ walletClient: null });
    const { result, rerender } = renderHook(() => useDeployWizard(), { wrapper: TestWrapper });
    const staleRun = result.current.run;

    setWagmiMockState({ walletClient: { deployContract: laterDeploy } });
    rerender();

    await act(async () => {
      await staleRun(validConfig());
    });

    const resolved = await executorParams[0].resolveDeployContractAsync();
    await resolved({ foo: 1 });
    expect(laterDeploy).toHaveBeenCalledWith({ foo: 1 });
  });

  it("refetches the wallet client at call time when still unresolved", async () => {
    setWagmiMockState({
      walletClient: null,
      walletClientRefetch: async () => ({ data: { deployContract: laterDeploy } })
    });
    const { result } = renderHook(() => useDeployWizard(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.run(validConfig());
    });

    const resolved = await executorParams[0].resolveDeployContractAsync();
    expect(resolved).toBeTypeOf("function");
    await resolved({ bar: 2 });
    expect(laterDeploy).toHaveBeenCalledWith({ bar: 2 });
  });

  it("resolves undefined when the client is still unavailable after refetch", async () => {
    setWagmiMockState({ walletClient: null });
    const { result } = renderHook(() => useDeployWizard(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.run(validConfig());
    });

    await expect(executorParams[0].resolveDeployContractAsync()).resolves.toBeUndefined();
  });
});
