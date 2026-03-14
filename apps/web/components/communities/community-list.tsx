"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useMyDeployedCommunities } from "../../hooks/useMyDeployedCommunities";
import { CommunitiesQuery, type CommunitiesQueryResult } from "../../lib/graphql/queries";
import type { CommunityNode } from "../../lib/graphql/queries";

function CommunityGrid({ communities }: { communities: CommunityNode[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <li key={community.id} className="card block">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Chain {community.chainId}</span>
              <span>ID {community.id}</span>
            </div>
            <div className="space-y-1">
              <span className="text-lg font-semibold">{community.name ?? `Community ${community.id}`}</span>
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

export function CommunityList() {
  const { communityIds: myCommunityIds } = useMyDeployedCommunities();
  const { data, isLoading, isError, refetch } = useGraphQLQuery<CommunitiesQueryResult, { limit?: number }>(
    ["communities", { limit: 20 }],
    CommunitiesQuery,
    { limit: 20 }
  );

  const communities = useMemo(() => data?.communities.nodes ?? [], [data]);
  const myIdsSet = useMemo(() => new Set(myCommunityIds.map(String)), [myCommunityIds]);
  const { myCommunities, otherCommunities } = useMemo(() => {
    const my: CommunityNode[] = [];
    const other: CommunityNode[] = [];
    for (const c of communities) {
      if (myIdsSet.has(String(c.id))) my.push(c);
      else other.push(c);
    }
    return { myCommunities: my, otherCommunities: other };
  }, [communities, myIdsSet]);

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
    <div className="space-y-8">
      {myCommunities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            My communities
          </h3>
          <CommunityGrid communities={myCommunities} />
        </div>
      ) : null}
      {otherCommunities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {myCommunities.length > 0 ? "All communities" : "Indexed communities"}
          </h3>
          <CommunityGrid communities={otherCommunities} />
        </div>
      ) : null}
    </div>
  );
}
