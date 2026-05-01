"use client";

import Link from "next/link";

import { useIndexerHealth } from "../../hooks/useIndexerHealth";
import { getI18n } from "../../lib/i18n";

export function GovernanceTopBar({ communityId }: { communityId: number }) {
  const t = getI18n().governance;
  const health = useIndexerHealth(new Date().toISOString());

  const healthClass = {
    synced: "text-emerald-700",
    lagging: "text-amber-700",
    error: "text-red-700",
    unknown: "text-slate-600"
  }[health.state];

  return (
    <header className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.communityGovernanceBadge}</p>
          <h1 className="text-2xl font-semibold">{t.communityGovernanceTitle.replace("{id}", String(communityId))}</h1>
        </div>
        <span className={`text-sm font-medium ${healthClass}`}>{t.topBarIndexer.replace("{state}", health.state)}</span>
      </div>
      <div>
        <Link className="text-sm underline" href={`/communities/${communityId}`}>
          {t.backToOverview}
        </Link>
      </div>
      <details className="rounded-xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
          {t.topBarIndexerDetails}
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.topBarIndexerHelp}</p>
      </details>
    </header>
  );
}
