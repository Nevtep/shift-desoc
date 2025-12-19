"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { ClaimsQuery, type ClaimNode, type ClaimsQueryResult } from "../../lib/graphql/queries";

export type ClaimListProps = {
  communityId?: string;
};

export function ClaimList({ communityId }: ClaimListProps) {
  const variables = communityId ? { communityId } : undefined;
  const { data, isLoading, isError, refetch } = useGraphQLQuery<ClaimsQueryResult, { communityId?: string }>(
    ["claims", variables],
    ClaimsQuery,
    variables
  );

  const claims = useMemo(() => data?.claims.nodes ?? [], [data]);

  if (isLoading) return <StatusMessage message="Loading claims…" />;
  if (isError)
    return (
      <div className="space-y-2">
        <StatusMessage message="Failed to load claims." tone="error" />
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  if (!claims.length) return <StatusMessage message="No claims indexed yet." />;

  return (
    <ul className="space-y-3">
      {claims.map((claim) => (
        <ClaimListItem key={claim.id} claim={claim} />
      ))}
    </ul>
  );
}

function ClaimListItem({ claim }: { claim: ClaimNode }) {
  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Valuable Action {claim.valuableActionId}</span>
          <span>Submitted {formatDistanceToNow(new Date(claim.submittedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Claim {claim.id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{claim.status}</span>
        </div>
        <Link className="text-sm underline" href={`/claims/${claim.id}`}>
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
