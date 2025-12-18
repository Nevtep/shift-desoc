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
  useMemo,
  useState
} from "react";
import type { Config as WagmiConfigType } from "wagmi";
import { WagmiConfig } from "wagmi";

const GraphQLClientContext = createContext<GraphQLClient | null>(null);

export function useGraphQLClient() {
  const client = useContext(GraphQLClientContext);
  if (!client) {
    throw new Error("useGraphQLClient must be used within <ShiftProviders>");
  }
  return client;
}

export type ShiftProvidersProps = PropsWithChildren<{
  wagmiConfig: WagmiConfigType;
  graphqlUrl: string;
}>;

export function ShiftProviders({
  wagmiConfig,
  graphqlUrl,
  children
}: ShiftProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  const graphClient = useMemo(() => new GraphQLClient(graphqlUrl), [graphqlUrl]);

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <GraphQLClientContext.Provider value={graphClient}>
          {children}
        </GraphQLClientContext.Provider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}
