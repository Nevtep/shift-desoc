"use client";

import { useMemo } from "react";

import { useApiQuery } from "./useApiQuery";
import type { ValuableActionDto } from "../lib/graphql/queries";

type CatalogResponse = {
  communityId: number;
  items: Array<{
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
  }>;
};

function mapItem(item: CatalogResponse["items"][number]): ValuableActionDto {
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

export function useValuableActionCatalog(communityId: number) {
  const query = useApiQuery<CatalogResponse>(
    ["valuable-action-catalog", communityId],
    `/communities/${communityId}/valuable-actions`,
    {
      staleTime: 15_000,
      retry: false,
      enabled: Number.isFinite(communityId) && communityId > 0,
    }
  );

  const items = useMemo(() => {
    const next = (query.data?.items ?? []).map(mapItem);
    return next.sort((a, b) => a.actionId - b.actionId);
  }, [query.data?.items]);

  return {
    ...query,
    items,
    isEmpty: !query.isLoading && items.length === 0,
  };
}
