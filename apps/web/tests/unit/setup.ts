import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./server";
import { wagmiMockState, buildMockedHooks } from "./mocks/wagmiMock";

// Default envs for client code
process.env.NEXT_PUBLIC_GRAPHQL_URL ||= "http://localhost:4000/graphql";
process.env.NEXT_PUBLIC_INDEXER_API_URL ||= "http://localhost:4000";
process.env.NEXT_PUBLIC_CHAIN_ID ||= "84532";

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
    useWriteContract: () => buildMockedHooks().writeContract
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
