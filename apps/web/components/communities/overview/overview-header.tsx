import Link from "next/link";
import type { Route } from "next";

import type { OverviewHeaderState } from "../../../lib/community-overview/types";

export function OverviewHeader({ header }: { header: OverviewHeaderState }) {
  const healthClass = {
    synced: "text-emerald-700",
    lagging: "text-amber-700",
    error: "text-red-700",
    unknown: "text-slate-600"
  }[header.health];

  return (
    <header className="card space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Community</p>
        <h1 className="text-2xl font-semibold">{header.displayName}</h1>
        <p className="text-sm text-muted-foreground">ID {header.communityId} · {header.network} · {header.environment}</p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className={healthClass}>Indexer: {header.health}</span>
        <span className="text-muted-foreground">Last checked: {new Date(header.lastCheckedAt).toLocaleString()}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {header.actions.valuableActions.enabled ? (
          <Link className="btn-outline" href={header.actions.valuableActions.href as Route}>Valuable actions</Link>
        ) : (
          <button className="btn-outline" disabled>
            Valuable actions{header.actions.valuableActions.comingSoon ? " (Coming soon)" : ""}
          </button>
        )}
        {header.actions.viewParameters.enabled ? (
          <Link className="btn-outline" href={header.actions.viewParameters.href as Route}>View parameters</Link>
        ) : (
          <button className="btn-outline" disabled>
            View parameters{header.actions.viewParameters.comingSoon ? " (Coming soon)" : ""}
          </button>
        )}
        {header.actions.editParameters.enabled ? (
          <Link className="btn-secondary" href={header.actions.editParameters.href as Route}>Edit parameters</Link>
        ) : (
          <button className="btn-secondary" disabled>
            Edit parameters{header.actions.editParameters.comingSoon ? " (Coming soon)" : ""}
          </button>
        )}
      </div>
    </header>
  );
}
