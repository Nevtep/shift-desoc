"use client";

import type { ValuableActionReadiness } from "../../hooks/useValuableActionReadiness";

type Props = {
  readiness: ValuableActionReadiness;
};

export function ValuableActionReadinessBanner({ readiness }: Props) {
  const color = readiness.status === "healthy" ? "text-emerald-600" : readiness.status === "lagging" ? "text-amber-600" : "text-red-600";
  return (
    <section className="card p-3" aria-label="valuable-action-readiness-banner">
      <p className={`text-sm font-medium ${color}`}>Projection readiness: {readiness.status}</p>
      <p className="text-xs text-muted-foreground">{readiness.details || "No additional readiness details."}</p>
    </section>
  );
}
