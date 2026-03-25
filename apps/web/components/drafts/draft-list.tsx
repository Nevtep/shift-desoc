"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { DraftsQuery, type DraftsQueryResult } from "../../lib/graphql/queries";

export type DraftNode = {
  id: string;
  nativeId: number | null;
  requestId: number;
  status: string;
  latestVersionCid?: string | null;
  escalatedProposalId?: string | null;
  updatedAt: string | number | null;
};

export type DraftListProps = {
  communityId?: string;
  detailHrefBuilder?: (draft: DraftNode) => string;
  detailHrefBasePath?: string;
};

export function DraftList({ communityId, detailHrefBuilder, detailHrefBasePath }: DraftListProps) {
  type DraftsQueryVars = { limit: number; communityId?: number };

  const variables: DraftsQueryVars = communityId
    ? { communityId: Number(communityId), limit: 20 }
    : { limit: 20 };

  const { data, isLoading, isError, refetch } = useGraphQLQuery<DraftsQueryResult, DraftsQueryVars>(
    ["drafts", communityId ?? "all"],
    DraftsQuery,
    variables
  );

  const drafts = useMemo(() => {
    const parseNativeId = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value !== "string") return null;
      const normalized = value.trim();
      if (!normalized) return null;
      const candidate = normalized.includes(":") ? normalized.split(":").pop() ?? normalized : normalized;
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return (data?.drafts.nodes ?? []).map((node) => ({
      ...node,
      id: String(node.id),
      nativeId: parseNativeId(node.id),
      requestId: parseNativeId(node.requestId) ?? 0,
      updatedAt: (node.updatedAt as string | number | null | undefined) ?? null
    }));
  }, [data]);

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
        <DraftListItem
          key={draft.id}
          draft={draft}
          detailHref={
            detailHrefBasePath
              ? `${detailHrefBasePath}/${draft.id}`
              : detailHrefBuilder
                ? detailHrefBuilder(draft)
                : undefined
          }
        />
      ))}
    </ul>
  );
}

function DraftListItem({
  draft,
  detailHrefBuilder,
  detailHref
}: {
  draft: DraftNode;
  detailHrefBuilder?: (draft: DraftNode) => string;
  detailHref?: string;
}) {
  const parseDateValue = (value: string | number | null): Date | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === "number" && Number.isFinite(value)) {
      const ms = value < 1_000_000_000_000 ? value * 1000 : value;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        const ms = parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
      }
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const updatedDate = parseDateValue(draft.updatedAt);
  const resolvedDetailHref = detailHref ?? (detailHrefBuilder ? detailHrefBuilder(draft) : `/drafts/${draft.id}`);

  return (
    <li className="card">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Request {draft.requestId}</span>
          <span>
            Updated {updatedDate ? formatDistanceToNow(updatedDate, { addSuffix: true }) : "unknown"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Draft {draft.nativeId ?? draft.id}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{draft.status}</span>
          {draft.escalatedProposalId ? (
            <Link className="text-xs underline" href={`/governance/proposals/${draft.escalatedProposalId}`}>
              Proposal {draft.escalatedProposalId}
            </Link>
          ) : null}
        </div>
        <Link className="text-sm underline" href={resolvedDetailHref}>
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
