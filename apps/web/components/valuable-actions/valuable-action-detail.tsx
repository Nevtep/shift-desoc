"use client";

import Link from "next/link";

import type { ValuableActionDto } from "../../lib/graphql/queries";
import { buildValuableActionProposalHref } from "../../lib/valuable-actions/governance";

type Props = {
  communityId: number;
  action: ValuableActionDto | null;
};

export function ValuableActionDetail({ communityId, action }: Props) {
  if (!action) {
    return (
      <section className="space-y-2" aria-label="valuable-action-detail-empty">
        <p className="text-sm text-muted-foreground">Select a valuable action to inspect details.</p>
        <p className="text-xs text-muted-foreground">After selecting an item you can propose activation or deactivation from here.</p>
      </section>
    );
  }

  return (
    <article className="card space-y-3 p-4" aria-label="valuable-action-detail">
      <header>
        <h2 className="text-lg font-semibold">{action.title}</h2>
        <p className="text-xs text-muted-foreground">Action #{action.actionId}</p>
      </header>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{action.isActive ? "Active" : "Inactive"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evidence Spec CID</dt>
          <dd>{action.evidenceSpecCid || "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated Block</dt>
          <dd>{action.lifecycle.updatedAtBlock}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last Event</dt>
          <dd>{action.lifecycle.lastEventName}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link
          className="btn-outline"
          href={buildValuableActionProposalHref({
            communityId,
            operation: action.isActive ? "deactivate" : "activate",
            actionId: action.actionId,
            nextActive: !action.isActive,
          })}
        >
          {action.isActive ? "Propose Deactivation" : "Propose Activation"}
        </Link>
      </div>
    </article>
  );
}
