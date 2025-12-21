"use client";

import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
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
};

export function RequestList({ communityId }: RequestListProps) {
  type RequestsQueryVars = { limit: number; communityId?: number };

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
      id: Number(node.id),
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
    return <StatusMessage message="Loading requests…" />;
  }

  if (isError) {
    return (
      <RequestListError refetch={refetch} />
    );
  }

  if (!requests.length) {
    return <StatusMessage message="No requests indexed yet." />;
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <RequestListItem
          key={request.id}
          request={request}
          communityName={communityNameById.get(request.communityId)}
        />
      ))}
    </ul>
  );
}
