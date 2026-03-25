import Link from "next/link";

import type { ActivityPanelState } from "../../../lib/community-overview/types";

const PANEL_LABELS: Record<ActivityPanelState["domain"], string> = {
  requests: "Requests",
  drafts: "Drafts",
  proposals: "Proposals"
};

export function ActivityPanel({ panel }: { panel: ActivityPanelState }) {
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">{PANEL_LABELS[panel.domain]}</h3>
        <div className="flex gap-2">
          {panel.viewAll.enabled ? (
            <Link className="btn-ghost" href={panel.viewAll.href}>View all</Link>
          ) : (
            <button className="btn-ghost" disabled>
              View all{panel.viewAll.comingSoon ? " (Coming soon)" : ""}
            </button>
          )}
          {panel.create.enabled ? (
            <Link className="btn-ghost" href={panel.create.href}>Create new</Link>
          ) : (
            <button className="btn-ghost" disabled>
              Create new{panel.create.comingSoon ? " (Coming soon)" : ""}
            </button>
          )}
        </div>
      </div>

      {panel.state === "loading" ? <p className="text-sm text-muted-foreground">Loading preview…</p> : null}
      {panel.state === "empty" ? <p className="text-sm text-muted-foreground">No recent activity.</p> : null}
      {panel.state === "error" ? <p className="text-sm text-red-700">Indexer unavailable. Retry to refresh previews.</p> : null}
      {panel.state === "lagging" ? <p className="text-sm text-amber-700">Indexer lagging: previews may be stale.</p> : null}

      {panel.items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {panel.items.map((item) => (
            <li key={`${panel.domain}-${item.id}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.titleOrIdentifier}</span>
              <span className="text-muted-foreground">{item.status}</span>
              <span className="text-muted-foreground">{new Date(item.timestamp).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
