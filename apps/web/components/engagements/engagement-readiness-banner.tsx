"use client";

import { useEngagementReadiness } from "../../hooks/useEngagementReadiness";
import { getI18n } from "../../lib/i18n";

export function EngagementReadinessBanner({ communityId }: { communityId?: number }) {
  const t = getI18n().engagementList.readiness;
  const { readiness, enabled, isLoading } = useEngagementReadiness(communityId);
  if (!enabled || isLoading) return null;

  const color =
    readiness.status === "healthy" ? "text-emerald-600" : readiness.status === "lagging" ? "text-amber-600" : "text-red-600";
  const lagNote = readiness.blockLag && readiness.status !== "unavailable" ? ` (${readiness.blockLag} ${t.blocksBehind})` : "";

  return (
    <section className="card p-3" aria-label="engagement-readiness-banner">
      <p className={`text-sm font-medium ${color}`}>
        {t.label}: {t.status[readiness.status]}
        {lagNote}
      </p>
      <p className="text-xs text-muted-foreground">{readiness.status === "healthy" ? t.healthyHint : t.degradedHint}</p>
    </section>
  );
}
