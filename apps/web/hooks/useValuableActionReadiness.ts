"use client";

import { useMemo } from "react";

import type { ValuableActionReadinessStatus } from "../lib/community-overview/types";
import { useApiQuery } from "./useApiQuery";

export type ValuableActionReadiness = {
  status: ValuableActionReadinessStatus;
  indexedBlock: string | null;
  chainHeadBlock: string | null;
  blockLag: string | null;
  indexedAt: string | null;
  details: string | null;
  isStale: boolean;
};

type ReadinessApiResponse = {
  status?: string;
  indexedBlock?: string;
  chainHeadBlock?: string;
  blockLag?: string;
  indexedAt?: string;
  details?: string;
};

export function mapValuableActionReadiness(
  payload: ReadinessApiResponse | null | undefined,
  now: Date,
  staleMs = 90_000
): ValuableActionReadiness {
  const rawStatus = (payload?.status ?? "unavailable").toLowerCase();
  const status: ValuableActionReadinessStatus =
    rawStatus === "healthy" || rawStatus === "lagging" || rawStatus === "unavailable"
      ? (rawStatus as ValuableActionReadinessStatus)
      : "unavailable";

  const indexedAt = payload?.indexedAt ?? null;
  const indexedAtMs = indexedAt ? Date.parse(indexedAt) : Number.NaN;
  const isStale = Number.isFinite(indexedAtMs) ? now.getTime() - indexedAtMs > staleMs : true;

  if (isStale && status === "healthy") {
    return {
      status: "lagging",
      indexedBlock: payload?.indexedBlock ?? null,
      chainHeadBlock: payload?.chainHeadBlock ?? null,
      blockLag: payload?.blockLag ?? null,
      indexedAt,
      details: payload?.details ?? "Projection freshness exceeded stale threshold.",
      isStale: true,
    };
  }

  return {
    status,
    indexedBlock: payload?.indexedBlock ?? null,
    chainHeadBlock: payload?.chainHeadBlock ?? null,
    blockLag: payload?.blockLag ?? null,
    indexedAt,
    details: payload?.details ?? null,
    isStale,
  };
}

export function useValuableActionReadiness(communityId: number) {
  const query = useApiQuery<ReadinessApiResponse>(
    ["valuable-action-readiness", communityId],
    `/communities/${communityId}/valuable-actions/readiness`,
    {
      staleTime: 30_000,
      retry: false,
      enabled: Number.isFinite(communityId) && communityId > 0,
    }
  );

  const readiness = useMemo(
    () => mapValuableActionReadiness(query.data, new Date()),
    [query.data]
  );

  return {
    ...query,
    readiness,
  };
}
