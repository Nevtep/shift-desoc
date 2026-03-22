import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./server";
import { wagmiMockState, buildMockedHooks } from "./mocks/wagmiMock";

// Default envs for client code
process.env.NEXT_PUBLIC_GRAPHQL_URL ||= "http://localhost:4000/graphql";
process.env.NEXT_PUBLIC_INDEXER_API_URL ||= "http://localhost:4000";
process.env.NEXT_PUBLIC_CHAIN_ID ||= "84532";
process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY ||= "0x0000000000000000000000000000000000000101";
process.env.NEXT_PUBLIC_PARAM_CONTROLLER ||= "0x0000000000000000000000000000000000000102";
process.env.NEXT_PUBLIC_ACCESS_MANAGER ||= "0x0000000000000000000000000000000000000103";
process.env.NEXT_PUBLIC_POSITION_MANAGER ||= "0x0000000000000000000000000000000000000109";
process.env.NEXT_PUBLIC_MARKETPLACE ||= "0x0000000000000000000000000000000000000117";
process.env.NEXT_PUBLIC_REVENUE_ROUTER ||= "0x0000000000000000000000000000000000000118";
process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR ||= "0x0000000000000000000000000000000000000119";
process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY ||= "0x0000000000000000000000000000000000000121";
process.env.NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY ||= "0x0000000000000000000000000000000000000122";
process.env.NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY ||= "0x0000000000000000000000000000000000000123";
process.env.NEXT_PUBLIC_COMMERCE_LAYER_FACTORY ||= "0x0000000000000000000000000000000000000124";
process.env.NEXT_PUBLIC_COORDINATION_LAYER_FACTORY ||= "0x0000000000000000000000000000000000000125";

// Mock Next.js navigation hooks used by forms that trigger router.refresh
vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn()
    }),
    usePathname: () => "",
    useSearchParams: () => new URLSearchParams()
  };
});

// Mock wagmi hooks centrally so tests can configure via wagmiMockState
vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useAccount: () => buildMockedHooks().account,
    useChainId: () => buildMockedHooks().chainId,
    useChains: () => buildMockedHooks().chains,
    useConnect: () => buildMockedHooks().connect,
    useDisconnect: () => buildMockedHooks().disconnect,
    useSwitchChain: () => buildMockedHooks().switchChain,
    useWriteContract: () => buildMockedHooks().writeContract,
    useWalletClient: () => buildMockedHooks().walletClient,
    useReadContract: () => ({ data: undefined, isLoading: false, isError: false }),
    usePublicClient: () => ({
      waitForTransactionReceipt: async () => ({
        status: "success",
        logs: [],
        contractAddress: "0x000000000000000000000000000000000000dEaD"
      }),
      estimateContractGas: async () => 300000n,
      readContract: async () => 1n,
      getBytecode: async () => "0x1234",
      getBalance: async () => 10_000_000_000_000_000_000n,
      getTransactionCount: async () => 0n,
      getBlockNumber: async () => 38_600_000n,
      getLogs: async () => []
    })
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.restoreAllMocks();
  wagmiMockState.connected = false;
  wagmiMockState.address = undefined;
  wagmiMockState.chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
});
afterAll(() => server.close());
