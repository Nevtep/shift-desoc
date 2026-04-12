"use client";

import { useMemo } from "react";
import { useApiQuery } from "./useApiQuery";
import { useValuableActionReadiness } from "./useValuableActionReadiness";
import type { ValuableActionDto } from "../lib/graphql/queries";

type DetailResponse = {
  communityId: number;
  actionId: number;
  item: {
    id: string;
    communityId: number;
    actionId: number;
    titleTemplate?: string | null;
    evidenceSpecCid?: string | null;
    metadataSchemaId?: string | null;
    isActive: boolean;
    createdAtBlock: string;
    updatedAtBlock: string;
    activatedAtBlock?: string | null;
    deactivatedAtBlock?: string | null;
    lastEventTxHash: string;
    lastEventName: string;
    createdAt: string;
    updatedAt: string;
  };
};

function mapItem(item: DetailResponse["item"]): ValuableActionDto {
  return {
    id: item.id,
    communityId: Number(item.communityId),
    actionId: Number(item.actionId),
    title: item.titleTemplate?.trim() || `Action #${item.actionId}`,
    evidenceSpecCid: item.evidenceSpecCid ?? null,
    metadataSchemaId: item.metadataSchemaId ?? null,
    isActive: Boolean(item.isActive),
    lifecycle: {
      createdAtBlock: String(item.createdAtBlock),
      updatedAtBlock: String(item.updatedAtBlock),
      activatedAtBlock: item.activatedAtBlock ? String(item.activatedAtBlock) : null,
      deactivatedAtBlock: item.deactivatedAtBlock ? String(item.deactivatedAtBlock) : null,
      lastEventTxHash: item.lastEventTxHash,
      lastEventName: item.lastEventName,
    },
    timestamps: {
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  };
}

export function useValuableActionDetail(communityId: number, actionId: number) {
  const readiness = useValuableActionReadiness(communityId);

  const query = useApiQuery<DetailResponse>(
    ["valuable-action-detail", communityId, actionId],
    `/communities/${communityId}/valuable-actions/${actionId}`,
    {
      staleTime: 15_000,
      retry: false,
      enabled: Number.isFinite(communityId) && communityId > 0 && Number.isFinite(actionId) && actionId >= 0,
    }
  );

  const item = useMemo(() => {
    if (query.data?.item) return mapItem(query.data.item);
    if (readiness.readiness.status === "unavailable") {
      return {
        id: `${communityId}:${actionId}:fallback`,
        communityId,
        actionId,
        title: `Action #${actionId}`,
        evidenceSpecCid: null,
        metadataSchemaId: null,
        isActive: false,
        lifecycle: {
          createdAtBlock: "0",
          updatedAtBlock: "0",
          activatedAtBlock: null,
          deactivatedAtBlock: null,
          lastEventTxHash: "",
          lastEventName: "fallback_unavailable_projection",
        },
        timestamps: {
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      };
    }
    return null;
  }, [actionId, communityId, query.data?.item, readiness.readiness.status]);

  const fallbackQuery = useApiQuery<{ enabled: boolean }>(
    ["valuable-action-fallback-trigger", communityId, actionId],
    `/api/health`,
    {
      enabled: readiness.readiness.status === "unavailable" && !item,
      retry: false,
    }
  );

  return {
    ...query,
    readiness: readiness.readiness,
    item,
    fallbackPending: fallbackQuery.isLoading,
    onchainFallback: null,
  };
}
