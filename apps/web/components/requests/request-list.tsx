"use client";

import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import {
  CommunitiesQuery,
  type CommunitiesQueryResult,
  RequestsQuery,
  type RequestsQueryResult
} from "../../lib/graphql/queries";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";

export type RequestNode = {
  id: number;
  communityId: number;
  author: string;
  status: string;
  cid: string;
  tags: string[];
  createdAt: string;
};

export type RequestListProps = {
  communityId?: string;
};

export function RequestList({ communityId }: RequestListProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<RequestsQueryResult>(
    ["requests", communityId ?? "all"],
    RequestsQuery,
    communityId ? { communityId: Number(communityId), limit: 20 } : { limit: 20 }
  );

  const { data: communitiesData } = useGraphQLQuery<CommunitiesQueryResult>(
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
        <RequestListItem
          key={request.id}
          request={request}
          communityName={communityNameById.get(request.communityId)}
        />
      ))}
    </ul>
  );
}

function RequestListItem({ request, communityName }: { request: RequestNode; communityName?: string }) {
  const { data: ipfs } = useIpfsDocument(request.cid, Boolean(request.cid));
  const title = ipfs?.data?.type === "request" ? ipfs.data.title : null;

  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {communityName ?? `Community ${request.communityId}`}
          </span>
          <span className="text-xs text-muted-foreground">
            Created {formatDate(request.createdAt)}
          </span>
        </div>
        <p className="text-sm font-medium">{title || `Request #${request.id}`}</p>
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

function formatDate(value?: string | number | null) {
  if (!value) return "Unknown";
  const numeric = typeof value === "string" ? Number(value) : value;

  // Handle ISO strings
  if (typeof value === "string") {
    const iso = new Date(value);
    if (!Number.isNaN(iso.valueOf())) return iso.toLocaleString();
  }

  // Handle numeric strings or numbers representing seconds/millis
  if (Number.isFinite(numeric)) {
    const d = new Date((numeric as number) < 1e12 ? (numeric as number) * 1000 : (numeric as number));
    if (!Number.isNaN(d.valueOf())) return d.toLocaleString();
  }

  return "Unknown";
}
