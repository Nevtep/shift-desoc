import type { Route } from "next";

export type ValuableActionGovernanceOperation = "create" | "edit" | "activate" | "deactivate";

export function buildValuableActionProposalHref(args: {
  communityId: number;
  operation: ValuableActionGovernanceOperation;
  actionId?: number;
  nextActive?: boolean;
}): Route {
  const query = new URLSearchParams();
  query.set("template", "valuable_action");
  query.set("operation", args.operation);
  if (typeof args.actionId === "number") query.set("actionId", String(args.actionId));
  if (typeof args.nextActive === "boolean") query.set("nextActive", String(args.nextActive));

  return `/communities/${args.communityId}/governance/proposals/new?${query.toString()}` as Route;
}

/**
 * Session-storage key for the fail-closed governance prefill draft used by the
 * Valuable Action create flow.
 */
export function buildValuableActionCreateDraftKey(communityId: number): string {
  return `va-proposal-draft:${communityId}`;
}

/**
 * Session-storage key for the fail-closed governance prefill draft used by the
 * Valuable Action edit flow, scoped per action so drafts cannot leak across
 * actions or communities.
 */
export function buildValuableActionEditDraftKey(communityId: number, actionId: number): string {
  return `va-proposal-draft:${communityId}:edit:${actionId}`;
}
