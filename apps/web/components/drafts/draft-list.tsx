"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, FilePenLine } from "lucide-react";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { getI18n } from "../../lib/i18n";
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
  const t = getI18n().draftList;

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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
        <ListSkeleton />
      </div>
    );
  }
  if (isError)
    return (
      <div className="card-tight space-y-3 border-destructive/25">
        <StatusMessage message={t.loadFailed} tone="error" />
        <button type="button" className="btn-ghost cursor-pointer text-sm" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  if (!drafts.length) {
    return (
      <div className="card-tight border-dashed border-primary/25 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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

function DraftListItem({
  draft,
  detailHrefBuilder,
  detailHref
}: {
  draft: DraftNode;
  detailHrefBuilder?: (draft: DraftNode) => string;
  detailHref?: string;
}) {
  const t = getI18n().draftList;
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
    <li>
      <Link
        className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.88)] via-background to-background/96 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-[0_12px_32px_rgba(221,136,72,0.12)] focus-visible:ring-2 focus-visible:ring-primary"
        href={resolvedDetailHref as Route}
      >
        <span
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-secondary/15 group-hover:text-secondaryDark group-hover:ring-secondary/25">
              <FilePenLine className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="font-heading text-base font-semibold leading-snug text-primary transition-colors group-hover:text-primaryDark sm:text-lg">
                {t.draft} {draft.nativeId ?? draft.id}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t.request} {draft.requestId}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-foreground/80 ring-1 ring-black/[0.04]">
            {draft.status}
          </span>
        </div>

        <div className="mt-4 space-y-2 border-t border-primary/10 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t.updated}{" "}
              {updatedDate ? formatDistanceToNow(updatedDate, { addSuffix: true }) : t.unknown}
            </span>
            {draft.escalatedProposalId ? (
              <>
                <span aria-hidden className="text-border">·</span>
                <span className="font-medium text-foreground/85">
                  {t.proposal} #{draft.escalatedProposalId}
                </span>
              </>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-secondary transition-colors group-hover:text-secondaryDark">
            {t.viewDetails}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
