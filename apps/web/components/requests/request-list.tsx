"use client";

import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import {
  RequestsQuery,
  type RequestsQueryResult,
  type RequestNode
} from "../../lib/graphql/queries";

export type RequestListProps = {
  communityId?: string;
};

export function RequestList({ communityId }: RequestListProps) {
  const variables = communityId ? { communityId } : undefined;

  const { data, isLoading, isError, refetch } = useGraphQLQuery<RequestsQueryResult>(
    ["requests", variables],
    RequestsQuery,
    variables
  );

  const requests = useMemo(() => data?.requests.nodes ?? [], [data]);

  if (isLoading) {
    return <StatusMessage message="Loading requests…" />;
  }

  if (isError) {
    return (
      <div className="space-y-2">
        <StatusMessage message="Failed to load requests." tone="error" />
        <button className="text-sm underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!requests.length) {
    return <StatusMessage message="No requests indexed yet." />;
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <RequestListItem key={request.id} request={request} />
      ))}
    </ul>
  );
}

function RequestListItem({ request }: { request: RequestNode }) {
  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Community {request.communityId}
          </span>
          <span className="text-xs text-muted-foreground">
            Created {new Date(request.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="text-sm font-medium">Request #{request.id}</p>
        <p className="text-sm text-muted-foreground">Author: {request.author}</p>
        <div className="flex flex-wrap gap-2">
          {request.tags?.length
            ? request.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide"
                >
                  {tag}
                </span>
              ))
            : null}
        </div>
        <a className="text-sm underline" href={`/requests/${request.id}`}>
          View details
        </a>
      </div>
    </li>
  );
}

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
