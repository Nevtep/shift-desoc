"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { EngagementsQuery, type EngagementNode, type EngagementsQueryResult } from "../../lib/graphql/queries";

export type EngagementListProps = {
  communityId?: string;
};

export function EngagementList({ communityId }: EngagementListProps) {
  const communityIdNumber = communityId ? Number(communityId) : undefined;
  const variables = Number.isFinite(communityIdNumber) ? { communityId: communityIdNumber } : undefined;
  const { data, isLoading, isError, refetch } = useGraphQLQuery<EngagementsQueryResult, { communityId?: number }>(
    ["engagements", variables],
    EngagementsQuery,
    variables
  );

  const engagements = useMemo(() => data?.engagements.nodes ?? [], [data]);

  if (isLoading) return <StatusMessage message="Loading engagements..." />;
  if (isError)
    return (
      <div className="space-y-2">
        <StatusMessage message="Failed to load engagements." tone="error" />
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  if (!engagements.length) return <StatusMessage message="No engagements indexed yet." />;

  return (
    <ul className="space-y-3">
      {engagements.map((engagement) => (
        <EngagementListItem key={engagement.id} engagement={engagement} />
      ))}
    </ul>
  );
}

function EngagementListItem({ engagement }: { engagement: EngagementNode }) {
  return (
    <li className="card">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Valuable Action {engagement.valuableActionId}</span>
          <span>Submitted {formatDistanceToNow(new Date(engagement.submittedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Engagement {engagement.id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{engagement.status}</span>
        </div>
        <Link className="text-sm underline" href={`/engagements/${engagement.id}`}>
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
