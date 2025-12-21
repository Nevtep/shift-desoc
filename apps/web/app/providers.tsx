"use client";

import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { GraphQLClient } from "graphql-request";
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Config as WagmiConfigType } from "wagmi";
import { WagmiConfig } from "wagmi";
import { createShiftConfig, getEnv } from "@shift/shared";
import { ToastProvider } from "../components/ui/toaster";

const GraphQLClientContext = createContext<GraphQLClient | null>(null);
const ApiBaseUrlContext = createContext<string | null>(null);

export function useGraphQLClient() {
  const client = useContext(GraphQLClientContext);
  if (!client) {
    throw new Error("useGraphQLClient must be used within <ShiftProviders>");
  }
  return client;
}

export function useApiBaseUrl() {
  const baseUrl = useContext(ApiBaseUrlContext);
  if (!baseUrl) {
    throw new Error("useApiBaseUrl must be used within <ShiftProviders>");
  }
  return baseUrl;
}

export type ShiftProvidersProps = PropsWithChildren<{
  graphqlUrl: string;
  apiBaseUrl: string;
}>;

export function ShiftProviders({
  graphqlUrl,
  apiBaseUrl,
  children
}: ShiftProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Tests should surface errors immediately; in prod the default retry behavior is fine.
            retry: process.env.NODE_ENV === "test" ? false : undefined
          }
        }
      })
  );

  const graphClient = useMemo(() => new GraphQLClient(graphqlUrl), [graphqlUrl]);
  const wagmiConfig: WagmiConfigType = useMemo(() => createShiftConfig({ env: getEnv() }), []);

  // Defer Wagmi/WalletConnect setup until after mount to avoid setState warnings during hydration.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <GraphQLClientContext.Provider value={graphClient}>
          <ApiBaseUrlContext.Provider value={apiBaseUrl}>
            <ToastProvider>{children}</ToastProvider>
          </ApiBaseUrlContext.Provider>
        </GraphQLClientContext.Provider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}
