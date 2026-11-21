import { base, baseSepolia } from "wagmi/chains";

export type WagmiMockState = {
  connected: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
  /** Records `connect(...)` and `switchChain(...)` calls made by components under test. */
  /** Network the wallet is really on; defaults to `chainId` (the app config chain). */
  walletChainId?: number;
  connectSpy?: (args: unknown) => void;
  switchChainSpy?: (args: unknown) => void;
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
  const walletChainId = wagmiMockState.walletChainId ?? chainId;
  const chains = [baseSepolia, base];
  const account = connected
    ? {
        address,
        chain: chains.find((c) => c.id === walletChainId),
        chainId: walletChainId,
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
      connect: (args: unknown) => {
        wagmiMockState.connectSpy?.(args);
      },
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
      switchChain: (args: unknown) => {
        wagmiMockState.switchChainSpy?.(args);
      },
      switchChainAsync: () => Promise.resolve(),
      variables: undefined
    },
    writeContract: {
      writeContract: () => undefined,
      writeContractAsync: () => Promise.resolve("0x1234" as `0x${string}`),
      data: undefined,
      error: null,
      failureReason: null,
      isPending: false,
      reset: () => undefined,
      status: "idle",
      variables: undefined
    },
    walletClient: {
      data: {
        deployContract: () => Promise.resolve("0x1234" as `0x${string}`)
      },
      error: null,
      isError: false,
      isLoading: false,
      isPending: false
    }
  };
}
