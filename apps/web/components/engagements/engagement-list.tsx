"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { getI18n } from "../../lib/i18n";
import { EngagementsQuery, type EngagementNode, type EngagementsQueryResult } from "../../lib/graphql/queries";

export type EngagementListProps = {
  communityId?: string;
};

export function EngagementList({ communityId }: EngagementListProps) {
  const t = getI18n().engagementList;
  const communityIdNumber = communityId ? Number(communityId) : undefined;
  const variables = Number.isFinite(communityIdNumber) ? { communityId: communityIdNumber } : undefined;
  const { data, isLoading, isError, refetch } = useGraphQLQuery<EngagementsQueryResult, { communityId?: number }>(
    ["engagements", variables],
    EngagementsQuery,
    variables
  );

  const engagements = useMemo(() => data?.engagements.nodes ?? [], [data]);

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
  if (!engagements.length) {
    return (
      <div className="card-tight border-dashed border-primary/25 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {engagements.map((engagement) => (
        <EngagementListItem key={engagement.id} engagement={engagement} />
      ))}
    </ul>
  );
}

function EngagementListItem({ engagement }: { engagement: EngagementNode }) {
  const t = getI18n().engagementList;
  return (
    <li>
      <Link
        className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)]"
        href={`/engagements/${engagement.id}`}
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-secondary/15 group-hover:text-secondaryDark group-hover:ring-secondary/25">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="font-heading text-lg font-semibold leading-snug text-primary transition-colors group-hover:text-primaryDark">
                {t.engagement} {engagement.id}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t.valuableAction} {engagement.valuableActionId}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-foreground ring-1 ring-border">
            {engagement.status}
          </span>
        </div>

        <div className="mt-4 border-t border-primary/10 pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t.submitted} {formatDistanceToNow(new Date(engagement.submittedAt), { addSuffix: true })}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-secondary transition-colors group-hover:text-secondaryDark">
              {t.viewDetails}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
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

function StatusMessage({ message, tone = "default" }: { message: string; tone?: "default" | "error" }) {
  const toneClass = tone === "error" ? "text-destructive" : "text-muted-foreground";
  return <p className={`text-sm ${toneClass}`}>{message}</p>;
}
