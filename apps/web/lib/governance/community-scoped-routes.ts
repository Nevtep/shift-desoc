export function communityProposalsPath(communityId: number | string): string {
  return `/communities/${communityId}/governance/proposals`;
}

export function communityProposalDetailPath(communityId: number | string, proposalId: number | string): string {
  return `${communityProposalsPath(communityId)}/${proposalId}`;
}

export function communityDraftsPath(communityId: number | string): string {
  return `/communities/${communityId}/coordination/drafts`;
}

export function communityDraftDetailPath(communityId: number | string, draftId: number | string): string {
  return `${communityDraftsPath(communityId)}/${draftId}`;
}
