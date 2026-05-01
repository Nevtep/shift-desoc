"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Copy, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { formatDistanceToNowSafe } from "../../lib/date";
import {
  ProposalsQuery,
  type ProposalNode,
  type ProposalsQueryResult
} from "../../lib/graphql/queries";
import { proposalStatusBadgeLabel } from "../../lib/governance/proposal-status";
import { getI18n } from "../../lib/i18n";
import { useToast } from "../ui/toaster";

export type ProposalListProps = {
  communityId?: string | number;
  detailHrefBasePath?: string;
};

export function ProposalList({ communityId, detailHrefBasePath }: ProposalListProps) {
  const t = getI18n().governance;
  const communityIdNumber = typeof communityId === "string" ? Number(communityId) : communityId;
  const variables = Number.isFinite(communityIdNumber) ? { communityId: Number(communityIdNumber) } : undefined;

  const [after, setAfter] = useState<string | undefined>(undefined);
  const [proposals, setProposals] = useState<ProposalNode[]>([]);
  const { push } = useToast();

  useEffect(() => {
    setAfter(undefined);
    setProposals([]);
  }, [communityIdNumber]);

  type ProposalQueryVariables = { communityId?: number; limit?: number; after?: string };

  const { data, isLoading, isError, refetch } = useGraphQLQuery<ProposalsQueryResult, ProposalQueryVariables>(
    ["proposals", variables, after ?? "start"],
    ProposalsQuery,
    { ...variables, after, limit: 10 }
  );

  useEffect(() => {
    const nextNodes = (data?.proposals.nodes ?? []).filter((node) => {
      if (!Number.isFinite(communityIdNumber)) {
        return true;
      }

      return Number(node.communityId) === Number(communityIdNumber);
    });

    if (!nextNodes.length) return;
    setProposals((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      nextNodes.forEach((node) => {
        if (!seen.has(node.id)) {
          merged.push(node);
          seen.add(node.id);
        }
      });
      return merged;
    });
  }, [data]);

  useEffect(() => {
    if (isError) {
      push(t.proposalListFailed, "error");
    }
  }, [isError, push, t.proposalListFailed]);

  const hasNextPage = data?.proposals.pageInfo.hasNextPage ?? false;
  const endCursor = data?.proposals.pageInfo.endCursor ?? undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t.proposalListLoading}</p>
        <ListSkeleton />
      </div>
    );
  }
  if (isError)
    return (
      <div className="card-tight space-y-3 border-destructive/25">
        <StatusMessage message={t.proposalListFailed} tone="error" />
        <button type="button" className="btn-ghost cursor-pointer text-sm" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  if (!proposals.length) {
    return (
      <div className="card-tight border-dashed border-primary/25 text-center">
        <p className="text-sm text-muted-foreground">{t.proposalListEmpty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalListItem
            key={proposal.id}
            proposal={proposal}
            detailHref={
              detailHrefBasePath
                ? `${detailHrefBasePath}/${proposal.id}`
                : `/governance/proposals/${proposal.id}`
            }
          />
        ))}
      </ul>
      <div className="flex items-center gap-3">
        {hasNextPage ? (
          <button
            className="text-sm underline"
            disabled={isLoading}
            onClick={() => {
              if (endCursor) setAfter(endCursor);
            }}
          >
            {isLoading ? t.proposalListLoadingMore : t.proposalListLoadMore}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">{t.proposalListNoMore}</span>
        )}
      </div>
    </div>
  );
}

function ProposalListItem({
  proposal,
  detailHref
}: {
  proposal: ProposalNode;
  detailHref: string;
}) {
  const t = getI18n().governance;
  const statusLabel = proposalStatusBadgeLabel(proposal.state);
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(proposal.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li>
      <article className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)]">
        <span
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1 space-y-2">
            <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-secondary/15 group-hover:text-secondaryDark group-hover:ring-secondary/25">
              <Scale className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{t.proposalListCommunity.replace("{id}", String(proposal.communityId))}</span>
              <span className="text-border">·</span>
              <span>{t.proposalListCreated.replace("{time}", formatDistanceToNowSafe(proposal.createdAt))}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-semibold text-primary transition-colors group-hover:text-primaryDark">
                {t.proposalListId.replace("{id}", truncateMiddle(proposal.id))}
              </h3>
              <button
                type="button"
                aria-label={copied ? t.codeCopied : t.copyCode}
                title={copied ? t.codeCopied : t.copyCode}
                onClick={handleCopy}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              </button>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-foreground ring-1 ring-border">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-primary/10 pt-3">
          <Link
            href={detailHref as Route}
            className="inline-flex items-center gap-1 text-sm font-semibold text-secondary transition-colors hover:text-secondaryDark focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t.proposalListView}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </article>
    </li>
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

function truncateMiddle(value: string, keep = 6) {
  if (!value || value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
