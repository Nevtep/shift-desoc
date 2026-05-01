"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useMyDeployedCommunities } from "../../hooks/useMyDeployedCommunities";
import { CommunitiesQuery, type CommunitiesQueryResult } from "../../lib/graphql/queries";
import type { CommunityNode } from "../../lib/graphql/queries";
import { getI18n } from "../../lib/i18n";

function CommunityGrid({ communities }: { communities: CommunityNode[] }) {
  const t = getI18n().communityList;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <li key={community.id} className="card block">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>{t.chain} {community.chainId}</span>
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
              {t.viewCommunity}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommunityList() {
  const t = getI18n().communityList;
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
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t.loadFailed}</p>
        <button className="text-sm underline" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  }

  if (!communities.length) {
    return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  }

  return (
    <div className="space-y-8">
      {myCommunities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.myCommunities}
          </h3>
          <CommunityGrid communities={myCommunities} />
        </div>
      ) : null}
      {otherCommunities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {myCommunities.length > 0 ? t.allCommunities : t.indexedCommunities}
          </h3>
          <CommunityGrid communities={otherCommunities} />
        </div>
      ) : null}
    </div>
  );
}
