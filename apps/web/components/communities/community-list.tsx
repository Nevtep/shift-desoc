"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useMyDeployedCommunities } from "../../hooks/useMyDeployedCommunities";
import { CommunitiesQuery, type CommunitiesQueryResult } from "../../lib/graphql/queries";
import type { CommunityNode } from "../../lib/graphql/queries";
import { getClientLocale, getI18n } from "../../lib/i18n";

const CHAIN_LABELS: Record<number, string> = {
  84532: "Base Sepolia",
  8453: "Base",
  11155111: "Ethereum Sepolia",
  1: "Ethereum"
};

function formatIndexedDate(iso: string, localeCode: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(localeCode === "en" ? "en-US" : "es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function CommunityGrid({ communities }: { communities: CommunityNode[] }) {
  const t = getI18n().communityList;
  const locale = getClientLocale();

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {communities.map((community) => {
        const chainLabel = CHAIN_LABELS[community.chainId] ?? `${t.chain} ${community.chainId}`;
        const displayName = community.name?.trim() || `Community ${community.id}`;
        const dateLabel = formatIndexedDate(community.createdAt, locale);

        return (
          <li key={community.id}>
            <Link
              href={`/communities/${community.id}`}
              className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)] focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-secondary/15 group-hover:text-secondaryDark group-hover:ring-secondary/25">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-heading text-lg font-semibold leading-snug text-primary transition-colors group-hover:text-primaryDark">
                      {displayName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.communityId} #{community.id}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-secondary/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-secondaryDark ring-1 ring-secondary/25">
                  {chainLabel}
                </span>
              </div>

              <div className="mt-4 space-y-2 border-t border-primary/10 pt-4">
                {community.metadataUri ? (
                  <p className="truncate font-mono text-[11px] text-muted-foreground" title={community.metadataUri}>
                    <span className="font-sans font-medium text-foreground/80">{t.metadata}: </span>
                    {community.metadataUri}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground">—</p>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {t.indexedSince}{" "}
                    <time dateTime={community.createdAt}>{dateLabel}</time>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-secondary transition-colors group-hover:text-secondaryDark">
                    {t.viewCommunity}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-[200px] animate-pulse rounded-2xl border border-border/80 bg-muted/40"
          aria-hidden
        />
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
        <ListSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card-tight space-y-3 border-destructive/25">
        <p className="text-sm text-destructive">{t.loadFailed}</p>
        <button type="button" className="btn-ghost cursor-pointer text-sm" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  }

  if (!communities.length) {
    return (
      <div className="card-tight border-dashed border-primary/25 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {myCommunities.length > 0 ? (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 max-w-[2rem] bg-border" aria-hidden />
            {t.myCommunities}
            <span className="h-px flex-1 bg-border" aria-hidden />
          </h3>
          <CommunityGrid communities={myCommunities} />
        </div>
      ) : null}
      {otherCommunities.length > 0 ? (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 max-w-[2rem] bg-border" aria-hidden />
            {myCommunities.length > 0 ? t.allCommunities : t.indexedCommunities}
            <span className="h-px flex-1 bg-border" aria-hidden />
          </h3>
          <CommunityGrid communities={otherCommunities} />
        </div>
      ) : null}
    </div>
  );
}
