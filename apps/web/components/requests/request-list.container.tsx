"use client";

import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { getI18n } from "../../lib/i18n";
import {
  CommunitiesQuery,
  type CommunitiesQueryResult,
  RequestsQuery,
  type RequestsQueryResult
} from "../../lib/graphql/queries";
import { RequestListError } from "./request-list-error.component";
import { StatusMessage } from "./status-message.component";
import { RequestListItem } from "./request-list-item.component";

export type RequestListProps = {
  communityId?: string;
  detailHrefBuilder?: (request: { id: string; communityId: number }) => string;
  detailHrefBasePath?: string;
};

function GridSkeleton({ count }: { count: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-[220px] animate-pulse rounded-2xl border border-border/80 bg-muted/40"
          aria-hidden
        />
      ))}
    </ul>
  );
}

export function RequestList({ communityId, detailHrefBuilder, detailHrefBasePath }: RequestListProps) {
  type RequestsQueryVars = { limit: number; communityId?: number };
  const t = getI18n().requestList;

  const variables: RequestsQueryVars = communityId
    ? { communityId: Number(communityId), limit: 20 }
    : { limit: 20 };

  const { data, isLoading, isError, refetch } = useGraphQLQuery<RequestsQueryResult, RequestsQueryVars>(
    ["requests", communityId ?? "all"],
    RequestsQuery,
    variables
  );

  const { data: communitiesData } = useGraphQLQuery<CommunitiesQueryResult, { limit: number }>(
    ["communities", "for-request-list"],
    CommunitiesQuery,
    { limit: 200 }
  );

  const requests = useMemo(() => {
    return (data?.requests.nodes ?? []).map((node) => ({
      ...node,
      id: node.id,
      communityId: Number(node.communityId)
    }));
  }, [data]);

  const communityNameById = useMemo(() => {
    const map = new Map<number, string>();
    (communitiesData?.communities.nodes ?? []).forEach((c) => {
      map.set(Number(c.id), c.name ?? `Community ${c.id}`);
    });
    return map;
  }, [communitiesData?.communities.nodes]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
        <GridSkeleton count={4} />
      </div>
    );
  }

  if (isError) {
    return <RequestListError refetch={refetch} />;
  }

  if (!requests.length) {
    return (
      <div className="card-tight border-dashed border-primary/25 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {requests.map((request) => (
        <RequestListItem
          key={request.id}
          request={request}
          communityName={communityNameById.get(request.communityId)}
          detailHref={
            detailHrefBasePath
              ? `${detailHrefBasePath}/${request.id}`
              : detailHrefBuilder
                ? detailHrefBuilder(request)
                : undefined
          }
        />
      ))}
    </ul>
  );
}
