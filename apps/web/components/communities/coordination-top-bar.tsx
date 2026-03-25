"use client";

import Link from "next/link";

import { useIndexerHealth } from "../../hooks/useIndexerHealth";

export function CoordinationTopBar({ communityId }: { communityId: number }) {
  const health = useIndexerHealth(new Date().toISOString());

  const healthClass = {
    synced: "text-emerald-700",
    lagging: "text-amber-700",
    error: "text-red-700",
    unknown: "text-slate-600"
  }[health.state];

  return (
    <header className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Community</p>
          <h1 className="text-2xl font-semibold">Community #{communityId}</h1>
        </div>
        <span className={`text-sm ${healthClass}`}>Indexer: {health.state}</span>
      </div>
      <div>
        <Link className="text-sm underline" href={`/communities/${communityId}`}>
          Back to Overview
        </Link>
      </div>
    </header>
  );
}
