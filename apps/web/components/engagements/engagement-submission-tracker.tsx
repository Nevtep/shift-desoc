"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { engagementPath } from "../../lib/engagements/engagement-id";
import { EngagementQuery, type EngagementQueryResult } from "../../lib/graphql/queries";

type Props = {
  txHash: string;
  communityId: number;
  /** null when the receipt did not expose the EngagementSubmitted event. */
  engagementId: number | null;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

/**
 * Tracks an already-confirmed `Engagements.submit` until the indexer projects it.
 * Nothing is persisted locally: the only source of truth polled is the indexer itself.
 */
export function EngagementSubmissionTracker({
  txHash,
  communityId,
  engagementId,
  pollIntervalMs = 4_000,
  timeoutMs = 90_000
}: Props) {
  const [timedOut, setTimedOut] = useState(false);
  const id = engagementId === null ? null : `${communityId}:${engagementId}`;

  const { data } = useGraphQLQuery<
    EngagementQueryResult,
    { id: string; communityId: number; engagementId: number }
  >(
    ["engagement-submission", id],
    EngagementQuery,
    id === null ? undefined : { id, communityId, engagementId: engagementId as number },
    {
      enabled: id !== null && !timedOut,
      refetchInterval: (query) => (query.state.data?.engagement ? false : pollIntervalMs)
    }
  );

  const indexed = Boolean(data?.engagement);

  useEffect(() => {
    if (indexed || id === null) return;
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [indexed, id, timeoutMs]);

  const detailHref = id === null ? null : (engagementPath(communityId, engagementId as number) as Route);

  return (
    <div className="mt-3 space-y-1 text-sm" role="status" aria-label="engagement-submission-status">
      <p className="text-xs text-muted-foreground">Transaction: {txHash}</p>
      {id === null ? (
        <p className="text-emerald-600">
          Confirmed on-chain. The engagement id could not be read from the receipt; check the engagements list once
          the indexer catches up.
        </p>
      ) : indexed ? (
        <p className="text-emerald-600">
          Indexed.{" "}
          <Link className="underline" href={detailHref as Route}>
            Open engagement {engagementId}
          </Link>
        </p>
      ) : timedOut ? (
        <p className="text-amber-600">
          Still not indexed; the chain read is available.{" "}
          <Link className="underline" href={detailHref as Route}>
            View engagement {engagementId} from the chain
          </Link>
        </p>
      ) : (
        <p className="text-amber-600">Confirmed on-chain, waiting for indexer…</p>
      )}
    </div>
  );
}
