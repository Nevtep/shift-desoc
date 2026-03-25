export type OverviewSectionKey =
  | "overview"
  | "coordination"
  | "governance"
  | "verification"
  | "economy"
  | "commerce";

export function communityBasePath(communityId: number | string): string {
  return `/communities/${communityId}`;
}

export function buildOverviewRoutes(communityId: number | string) {
  const base = communityBasePath(communityId);
  return {
    actions: {
      viewParameters: `${base}/parameters`,
      editParameters: `${base}/parameters/edit`
    },
    previews: {
      requests: {
        viewAll: `${base}/coordination/requests`,
        create: `${base}/coordination/requests/new`
      },
      drafts: {
        viewAll: `${base}/coordination/drafts`,
        create: `${base}/coordination/drafts/new`
      },
      proposals: {
        viewAll: `${base}/governance/proposals`,
        create: `${base}/governance/proposals/new`
      }
    },
    tabs: {
      overview: `${base}`,
      coordination: `${base}/coordination`,
      governance: `${base}/governance`,
      verification: `${base}/verification`,
      economy: `${base}/economy`,
      commerce: `${base}/commerce`
    }
  };
}
