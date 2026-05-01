"use client";

import { Check, Copy, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useBalance, useChainId } from "wagmi";

import { useMyDeployedCommunities } from "../../hooks/useMyDeployedCommunities";
import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import {
  CommunitiesQuery,
  EngagementsQuery,
  ProposalsQuery,
  RequestsQuery,
  type CommunitiesQueryResult,
  type EngagementsQueryResult,
  type ProposalsQueryResult,
  type RequestsQueryResult
} from "../../lib/graphql/queries";
import { getI18n } from "../../lib/i18n";

type ProfileOverviewProps = {
  allowlistProfileId: string;
  allowlistGeneratedAt: string;
  allowlistTargetCount: number;
  allowlistSignatureCount: number;
};

function truncateMiddle(value: string, keep = 6) {
  if (!value || value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ProfileOverview({
  allowlistProfileId,
  allowlistGeneratedAt,
  allowlistTargetCount,
  allowlistSignatureCount
}: ProfileOverviewProps) {
  const t = getI18n().profilePage;
  const { address, status } = useAccount();
  const chainId = useChainId();
  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: status === "connected" && Boolean(address) }
  });
  const { communityIds, hasCommunities, isLoading: isLoadingCommunities, refetch } = useMyDeployedCommunities();
  const [copied, setCopied] = useState(false);

  const { data: communitiesData } = useGraphQLQuery<CommunitiesQueryResult, { limit: number }>(
    ["communities", "profile"],
    CommunitiesQuery,
    { limit: 200 }
  );
  const { data: requestsData } = useGraphQLQuery<RequestsQueryResult, { limit: number }>(
    ["requests", "profile"],
    RequestsQuery,
    { limit: 100 }
  );
  const { data: proposalsData } = useGraphQLQuery<ProposalsQueryResult, { limit: number }>(
    ["proposals", "profile"],
    ProposalsQuery,
    { limit: 100 }
  );
  const { data: engagementsData } = useGraphQLQuery<EngagementsQueryResult, { limit: number }>(
    ["engagements", "profile"],
    EngagementsQuery,
    { limit: 100 }
  );

  const normalizedAddress = address?.toLowerCase();

  const myCommunityCards = useMemo(() => {
    const byId = new Map((communitiesData?.communities.nodes ?? []).map((c) => [Number(c.id), c]));
    return communityIds.map((id) => byId.get(Number(id))).filter(Boolean);
  }, [communitiesData?.communities.nodes, communityIds]);

  const myRequests = useMemo(() => {
    if (!normalizedAddress) return [];
    return (requestsData?.requests.nodes ?? []).filter((r) => r.author.toLowerCase() === normalizedAddress);
  }, [normalizedAddress, requestsData?.requests.nodes]);

  const myProposals = useMemo(() => {
    if (!normalizedAddress) return [];
    return (proposalsData?.proposals.nodes ?? []).filter((p) => p.proposer.toLowerCase() === normalizedAddress);
  }, [normalizedAddress, proposalsData?.proposals.nodes]);

  const myEngagements = useMemo(() => {
    if (!normalizedAddress) return [];
    return (engagementsData?.engagements.nodes ?? []).filter((e) => e.claimant.toLowerCase() === normalizedAddress);
  }, [engagementsData?.engagements.nodes, normalizedAddress]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  const isConnected = status === "connected";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.badge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="max-w-3xl text-muted-foreground">{t.subtitle}</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card1Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card1Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card2Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card2Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card3Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card3Body}</p>
        </article>
      </section>

      <section className="card space-y-4 border-primary/15">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
            <UserRound className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-primary">{t.identityTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.identityBody}</p>
          </div>
        </div>

        {isConnected && address ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t.walletAddress}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-foreground" title={address}>
                  {truncateMiddle(address)}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={copied ? t.codeCopied : t.copyCode}
                  title={copied ? t.codeCopied : t.copyCode}
                  onClick={() => void copyAddress()}
                >
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t.network}</p>
              <p className="mt-1 font-medium text-foreground">{chainId ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t.nativeBalance}</p>
              <p className="mt-1 font-medium text-foreground">
                {nativeBalance ? `${Number(nativeBalance.formatted).toFixed(4)} ${nativeBalance.symbol}` : t.unknown}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t.indexedActivity}</p>
              <p className="mt-1 font-medium text-foreground">
                {myRequests.length + myProposals.length + myEngagements.length}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-primary/25 bg-background/60 p-5 text-sm text-muted-foreground">
            {t.connectHint}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-primary">{t.communitiesTitle}</h2>
        {isLoadingCommunities ? (
          <p className="text-sm text-muted-foreground">{t.loadingCommunities}</p>
        ) : hasCommunities ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {myCommunityCards.map((community) => {
              if (!community) return null;
              return (
                <li key={community.id}>
                  <Link
                    href={`/communities/${community.id}`}
                    className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)]"
                  >
                    <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
                    <h3 className="font-heading text-lg font-semibold text-primary">
                      {community.name?.trim() || `Community ${community.id}`}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      #{community.id} · chain {community.chainId}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card-tight border-dashed border-primary/25 text-center">
            <p className="text-sm text-muted-foreground">{t.noCommunities}</p>
            <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => void refetch()}>
              {t.retry}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-primary">{t.activityTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="card-tight">
            <p className="text-xs text-muted-foreground">{t.requestsAuthored}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{myRequests.length}</p>
          </article>
          <article className="card-tight">
            <p className="text-xs text-muted-foreground">{t.proposalsAuthored}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{myProposals.length}</p>
          </article>
          <article className="card-tight">
            <p className="text-xs text-muted-foreground">{t.engagementsSubmitted}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{myEngagements.length}</p>
          </article>
        </div>
      </section>

      <section className="card space-y-4 border-primary/15">
        <h2 className="text-xl font-semibold text-primary">{t.infoTitle}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.infoIntro}</p>
        <details className="rounded-xl border border-border bg-background/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
            {t.infoMoreSummary}
          </summary>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t.infoLi1}</li>
            <li>{t.infoLi2}</li>
            <li>{t.infoLi3}</li>
            <li>{t.infoLi4}</li>
            <li>{t.infoLi5.replace("{id}", allowlistProfileId)}</li>
            <li>{t.infoLi6.replace("{date}", formatDate(allowlistGeneratedAt)).replace("{targets}", String(allowlistTargetCount)).replace("{sigs}", String(allowlistSignatureCount))}</li>
          </ul>
        </details>
      </section>
    </main>
  );
}
