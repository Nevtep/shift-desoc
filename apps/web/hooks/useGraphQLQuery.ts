"use client";

import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import type { RequestDocument, Variables } from "graphql-request";

import { useGraphQLClient } from "../app/providers";

type UseGraphQLQueryOptions<TData> = Omit<UseQueryOptions<TData>, "queryKey" | "queryFn">;

export function useGraphQLQuery<TData, TVariables extends Variables | undefined = undefined>(
  queryKey: QueryKey,
  document: RequestDocument,
  variables?: TVariables,
  options?: UseGraphQLQueryOptions<TData>
) {
  const client = useGraphQLClient();

  return useQuery<TData>({
    queryKey,
    queryFn: async () => client.request<TData>(document, variables as Variables | undefined),
    ...options
  });
}
