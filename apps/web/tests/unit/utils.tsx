import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { GraphQLClient } from "graphql-request";
import { PropsWithChildren } from "react";

import { ShiftProviders } from "../../app/providers";
import { apiBaseUrl as defaultApiBaseUrl, graphqlUrl as defaultGraphqlUrl } from "./mocks/handlers";
import { setWagmiMockState } from "./mocks/wagmiMock";

export type RenderOptions = {
  graphqlUrl?: string;
  apiBaseUrl?: string;
  queryClient?: QueryClient;
};

export function renderWithProviders(ui: React.ReactElement, options: RenderOptions = {}) {
  const graphqlUrl = options.graphqlUrl ?? defaultGraphqlUrl;
  const apiBaseUrl = options.apiBaseUrl ?? defaultApiBaseUrl;
  const queryClient = options.queryClient ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  // The app providers create their own QueryClient, so we only need to ensure the caller wraps
  // in a React Query provider when they want to share cache. For most tests the built-in provider
  // is enough, but wrapping again is safe for utilities like renderHook.
  return render(
    <QueryClientProvider client={queryClient}>
      <ShiftProviders graphqlUrl={graphqlUrl} apiBaseUrl={apiBaseUrl}>
        {ui}
      </ShiftProviders>
    </QueryClientProvider>
  );
}

export type WagmiMockOptions = {
  connected?: boolean;
  address?: `0x${string}`;
  chainId?: number;
};

export function mockWagmiHooks(options: WagmiMockOptions = {}) {
  const connected = options.connected ?? false;
  const address = (options.address ?? "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
  setWagmiMockState({ connected, address, chainId: options.chainId });
}

export function createGraphqlClient(url = defaultGraphqlUrl) {
  return new GraphQLClient(url);
}

export function TestWrapper({ children, graphqlUrl, apiBaseUrl }: PropsWithChildren<{ graphqlUrl?: string; apiBaseUrl?: string }>) {
  return (
    <ShiftProviders graphqlUrl={graphqlUrl ?? defaultGraphqlUrl} apiBaseUrl={apiBaseUrl ?? defaultApiBaseUrl}>
      {children}
    </ShiftProviders>
  );
}
