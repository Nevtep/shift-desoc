import type { Route } from "next";

export type ValuableActionGovernanceOperation = "create" | "activate" | "deactivate";

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
