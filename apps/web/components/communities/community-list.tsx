"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { CommunitiesQuery, type CommunitiesQueryResult } from "../../lib/graphql/queries";

export function CommunityList() {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<CommunitiesQueryResult, { limit?: number }>(
    ["communities", { limit: 20 }],
    CommunitiesQuery,
    { limit: 20 }
  );

  const communities = useMemo(() => data?.communities.nodes ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Loading communities…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Failed to load communities.</p>
        <button className="text-sm underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!communities.length) {
    return <p className="text-sm text-muted-foreground">No communities indexed yet.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <li
          key={community.id}
          className="rounded-lg border border-border p-4 shadow-sm transition hover:border-primary"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Chain {community.chainId}</span>
              <span>ID {community.id}</span>
            </div>
            <div className="space-y-1">
              <span className="text-lg font-semibold">{community.name}</span>
              {community.metadataUri ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {community.metadataUri}
                </span>
              ) : null}
            </div>
            <Link className="text-sm underline" href={`/communities/${community.id}`}>
              View community
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
