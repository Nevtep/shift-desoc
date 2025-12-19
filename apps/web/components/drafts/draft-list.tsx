"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import { useApiQuery } from "../../hooks/useApiQuery";

export type DraftNode = {
  id: number;
  requestId: number;
  status: string;
  latestVersionCid?: string | null;
  escalatedProposalId?: string | null;
  updatedAt: string;
};

export type DraftListProps = {
  communityId?: string;
};

export function DraftList({ communityId }: DraftListProps) {
  const variables = communityId ? { communityId } : undefined;
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (communityId) params.set("communityId", communityId);

  const { data, isLoading, isError, refetch } = useApiQuery<{ items: DraftNode[] }>(
    ["drafts", variables],
    `/drafts?${params.toString()}`
  );

  const drafts = useMemo(() => data?.items ?? [], [data]);

  if (isLoading) return <StatusMessage message="Loading drafts…" />;
  if (isError)
    return (
      <div className="space-y-2">
        <StatusMessage message="Failed to load drafts." tone="error" />
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  if (!drafts.length) return <StatusMessage message="No drafts indexed yet." />;

  return (
    <ul className="space-y-3">
      {drafts.map((draft) => (
        <DraftListItem key={draft.id} draft={draft} />
      ))}
    </ul>
  );
}

function DraftListItem({ draft }: { draft: DraftNode }) {
  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Request {draft.requestId}</span>
          <span>Updated {formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Draft {draft.id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{draft.status}</span>
          {draft.escalatedProposalId ? (
            <Link className="text-xs underline" href={`/governance/proposals/${draft.escalatedProposalId}`}>
              Proposal {draft.escalatedProposalId}
            </Link>
          ) : null}
        </div>
        <Link className="text-sm underline" href={`/drafts/${draft.id}`}>
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
