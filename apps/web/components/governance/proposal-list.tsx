"use client";

import Link from "next/link";
import type { Route } from "next";
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

  if (isLoading) return <StatusMessage message={t.proposalListLoading} />;
  if (isError)
    return (
      <div className="space-y-2">
        <StatusMessage message={t.proposalListFailed} tone="error" />
        <button className="text-xs underline" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  if (!proposals.length) return <StatusMessage message={t.proposalListEmpty} />;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
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

  return (
    <li className="card">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{t.proposalListCommunity.replace("{id}", String(proposal.communityId))}</span>
          <span>{t.proposalListCreated.replace("{time}", formatDistanceToNowSafe(proposal.createdAt))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{t.proposalListId.replace("{id}", proposal.id)}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{statusLabel}</span>
        </div>
        <Link className="text-sm underline" href={detailHref as Route}>
          {t.proposalListView}
        </Link>
      </div>
    </li>
  );
}

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
