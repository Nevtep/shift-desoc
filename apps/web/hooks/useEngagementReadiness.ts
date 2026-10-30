"use client";

import { useMemo } from "react";

import { useApiQuery } from "./useApiQuery";

export type EngagementReadinessStatus = "healthy" | "lagging" | "unavailable";

export type EngagementReadiness = {
  status: EngagementReadinessStatus;
  indexedBlock: string | null;
  chainHeadBlock: string | null;
  blockLag: string | null;
  indexedAt: string | null;
  details: string | null;
};

type EngagementReadinessApiResponse = Partial<Record<keyof EngagementReadiness, string | null>>;

// Unlike Valuable Action readiness this does NOT downgrade on `indexedAt` age: the endpoint's
// indexedAt is the last engagement activity, which is legitimately old for a quiet community.
// Lag is judged by the indexer from block distance.
export function mapEngagementReadiness(payload: EngagementReadinessApiResponse | null | undefined): EngagementReadiness {
  const raw = (payload?.status ?? "unavailable").toLowerCase();
  const status: EngagementReadinessStatus =
    raw === "healthy" || raw === "lagging" || raw === "unavailable" ? raw : "unavailable";
  return {
    status,
    indexedBlock: payload?.indexedBlock ?? null,
    chainHeadBlock: payload?.chainHeadBlock ?? null,
    blockLag: payload?.blockLag ?? null,
    indexedAt: payload?.indexedAt ?? null,
    details: payload?.details ?? null
  };
}

export function useEngagementReadiness(communityId: number | undefined) {
  const enabled = typeof communityId === "number" && Number.isFinite(communityId) && communityId > 0;
  const query = useApiQuery<EngagementReadinessApiResponse>(
    ["engagement-readiness", communityId],
    `/communities/${communityId}/engagements/readiness`,
    { staleTime: 15_000, retry: false, refetchInterval: 30_000, enabled }
  );
  const readiness = useMemo(
    () => (query.isError ? mapEngagementReadiness(null) : mapEngagementReadiness(query.data)),
    [query.data, query.isError]
  );
  return { ...query, readiness, enabled };
}
