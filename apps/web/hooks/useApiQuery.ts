"use client";

import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";

import { useApiBaseUrl } from "../app/providers";

export type UseApiQueryOptions<TData> = Omit<UseQueryOptions<TData>, "queryKey" | "queryFn">;

export function useApiQuery<TData>(queryKey: QueryKey, path: string, options?: UseApiQueryOptions<TData>) {
  const baseUrl = useApiBaseUrl();

  return useQuery<TData>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${baseUrl}${path}`);
      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }
      return (await res.json()) as TData;
    },
    ...options
  });
}
