import { base, baseSepolia } from "wagmi/chains";

export type WagmiMockState = {
  connected: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
};

export const wagmiMockState: WagmiMockState = {
  connected: false,
  address: undefined,
  chainId: baseSepolia.id
};

export function setWagmiMockState(partial: Partial<WagmiMockState>) {
  Object.assign(wagmiMockState, partial);
}

export function buildMockedHooks() {
  const { connected, address, chainId } = wagmiMockState;
  const chains = [baseSepolia, base];
  const account = connected
    ? {
        address,
        chain: chains.find((c) => c.id === chainId),
        chainId,
        connector: { id: "mock", name: "Mock", type: "mock" } as any,
        status: "connected" as const
      }
    : {
        address: undefined,
        chain: undefined,
        chainId: undefined,
        connector: undefined,
        status: "disconnected" as const
      };

  return {
    account,
    chainId,
    chains,
    connect: {
      connectors: [{ id: "mock", name: "Mock", type: "mock", uid: "mock-1" } as any],
      connect: () => Promise.resolve(),
      connectAsync: () => Promise.resolve({}),
      data: undefined,
      error: null,
      failureReason: null,
      isPending: false,
      pendingConnector: null,
      reset: () => undefined,
      status: account.status,
      variables: undefined
    },
    disconnect: {
      disconnect: () => Promise.resolve(),
      disconnectAsync: () => Promise.resolve(),
      error: null,
      isPending: false,
      reset: () => undefined,
      status: "idle"
    },
    switchChain: {
      chains,
      data: undefined,
      error: null,
      failureReason: null,
      isPending: false,
      reset: () => undefined,
      status: "idle",
      switchChain: () => Promise.resolve(),
      switchChainAsync: () => Promise.resolve(),
      variables: undefined
    },
    writeContract: {
      writeContract: () => undefined,
      writeContractAsync: () => Promise.resolve({}),
      data: undefined,
      error: null,
      failureReason: null,
      isPending: false,
      reset: () => undefined,
      status: "idle",
      variables: undefined
    }
  };
}
