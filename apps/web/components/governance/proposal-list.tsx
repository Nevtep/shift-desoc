"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import {
  ProposalsQuery,
  type ProposalNode,
  type ProposalsQueryResult
} from "../../lib/graphql/queries";

export type ProposalListProps = {
  communityId?: string | number;
};

export function ProposalList({ communityId }: ProposalListProps) {
  const communityIdNumber = typeof communityId === "string" ? Number(communityId) : communityId;
  const variables = Number.isFinite(communityIdNumber) ? { communityId: Number(communityIdNumber) } : undefined;

  const [after, setAfter] = useState<string | undefined>(undefined);
  const [proposals, setProposals] = useState<ProposalNode[]>([]);

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
    const nextNodes = data?.proposals.nodes ?? [];
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

  const hasNextPage = data?.proposals.pageInfo.hasNextPage ?? false;
  const endCursor = data?.proposals.pageInfo.endCursor ?? undefined;

  if (isLoading) return <StatusMessage message="Loading proposals…" />;
  if (isError)
    return (
      <div className="space-y-2">
        <StatusMessage message="Failed to load proposals." tone="error" />
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  if (!proposals.length) return <StatusMessage message="No proposals indexed yet." />;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {proposals.map((proposal) => (
          <ProposalListItem key={proposal.id} proposal={proposal} />
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
            {isLoading ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">No more proposals.</span>
        )}
      </div>
    </div>
  );
}

function ProposalListItem({ proposal }: { proposal: ProposalNode }) {
  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Community {proposal.communityId}</span>
          <span>Created {formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Proposal {proposal.id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{proposal.state}</span>
        </div>
        <Link className="text-sm underline" href={`/governance/proposals/${proposal.id}`}>
          View details
        </Link>
      </div>
    </li>
  );
}

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
