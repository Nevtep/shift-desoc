import type { ReactElement } from "react";

import type { ProposalNode, ProposalQueryResult } from "../../../lib/graphql/queries";
import { renderWithProviders } from "../utils";

export function buildCommunityRouteParams(communityId: number | string) {
  return Promise.resolve({ communityId: String(communityId) });
}

export function buildCommunityProposalRouteParams(communityId: number | string, proposalId: number | string) {
  return Promise.resolve({
    communityId: String(communityId),
    proposalId: String(proposalId)
  });
}

export function renderCommunityRoute(ui: ReactElement): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(ui);
}

export function makeProposalSummary(overrides: Partial<ProposalNode> = {}): ProposalNode {
  return {
    id: "100",
    communityId: 1,
    proposer: "0xabc1230000000000000000000000000000000000",
    state: "Active",
    createdAt: new Date("2024-03-01T00:00:00Z").toISOString(),
    queuedAt: null,
    executedAt: null,
    ...overrides
  };
}

export function makeProposalDetail(overrides: Partial<NonNullable<ProposalQueryResult["proposal"]>> = {}): NonNullable<ProposalQueryResult["proposal"]> {
  return {
    id: "100",
    communityId: 1,
    proposer: "0xabc1230000000000000000000000000000000000",
    descriptionCid: "proposal-desc-cid",
    descriptionHash: "0x1234",
    targets: ["0x0000000000000000000000000000000000000000"],
    values: ["0"],
    calldatas: ["0x"],
    state: "Active",
    createdAt: new Date("2024-03-01T00:00:00Z").toISOString(),
    queuedAt: null,
    executedAt: null,
    multiChoiceOptions: ["Option A", "Option B"],
    votes: [],
    ...overrides
  };
}
