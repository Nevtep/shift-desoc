"use client";

import { useMemo } from "react";

import { INDEXER_LAG_THRESHOLD_SECONDS } from "../lib/community-overview/constants";
import type { IndexerHealthState } from "../lib/community-overview/types";
import { useApiQuery } from "./useApiQuery";

type HealthResponse = {
  ok: boolean;
};

export function resolveIndexerHealth(args: {
  apiHealthy: boolean;
  apiError: boolean;
  newestPreviewTimestamp: string | null;
  now: Date;
  lagThresholdSeconds?: number;
}): IndexerHealthState {
  if (args.apiError) return "error";
  if (!args.apiHealthy) return "error";
  if (!args.newestPreviewTimestamp) return "unknown";

  const newestMs = Date.parse(args.newestPreviewTimestamp);
  if (Number.isNaN(newestMs)) return "unknown";

  const ageSeconds = Math.floor((args.now.getTime() - newestMs) / 1000);
  if (ageSeconds > (args.lagThresholdSeconds ?? INDEXER_LAG_THRESHOLD_SECONDS)) {
    return "lagging";
  }
  return "synced";
}

export function useIndexerHealth(newestPreviewTimestamp: string | null) {
  const query = useApiQuery<HealthResponse>(["indexer-health"], "/health", {
    staleTime: 30_000,
    retry: false
  });

  const state = useMemo(() => {
    return resolveIndexerHealth({
      apiHealthy: Boolean(query.data?.ok),
      apiError: query.isError,
      newestPreviewTimestamp,
      now: new Date()
    });
  }, [newestPreviewTimestamp, query.data?.ok, query.isError]);

  return {
    state,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch
  };
}
