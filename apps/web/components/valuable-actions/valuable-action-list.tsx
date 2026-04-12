"use client";

import Link from "next/link";

import type { ValuableActionDto } from "../../lib/graphql/queries";
import { buildValuableActionProposalHref } from "../../lib/valuable-actions/governance";

type Props = {
  communityId: number;
  actions: ValuableActionDto[];
  readinessStatus: "healthy" | "lagging" | "unavailable";
  onSelect?: (actionId: number) => void;
};

export function ValuableActionList({ communityId, actions, readinessStatus, onSelect }: Props) {
  if (actions.length === 0) {
    return (
      <section className="space-y-3" aria-label="valuable-action-list-empty">
        <p className="text-sm text-muted-foreground">No valuable actions found for this community yet.</p>
        <Link
          className="btn-primary"
          href={buildValuableActionProposalHref({ communityId, operation: "create" })}
        >
          Create Valuable Action Proposal
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="valuable-action-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Readiness: {readinessStatus}</p>
        <Link
          className="btn-primary-sm"
          href={buildValuableActionProposalHref({ communityId, operation: "create" })}
        >
          Create Proposal
        </Link>
      </div>
      <ul className="space-y-2">
        {actions.map((action) => (
          <li key={action.id} className="card flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{action.title}</p>
              <p className="text-xs text-muted-foreground">Action #{action.actionId}</p>
              <Link
                className="mt-1 inline-flex text-xs text-primary underline"
                href={buildValuableActionProposalHref({
                  communityId,
                  operation: action.isActive ? "deactivate" : "activate",
                  actionId: action.actionId,
                  nextActive: !action.isActive,
                })}
              >
                {action.isActive ? "Propose deactivation" : "Propose activation"}
              </Link>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => onSelect?.(action.actionId)}
              aria-label={`Open valuable action ${action.actionId}`}
            >
              {action.isActive ? "Active" : "Inactive"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
