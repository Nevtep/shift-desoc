export type OverviewSectionKey =
  | "overview"
  | "coordination"
  | "governance"
  | "verification"
  | "economy"
  | "commerce";

export const MANAGER_CAPABILITY_ROUTE_KEYS = {
  MARKETPLACE: "marketplace",
  MARKETPLACE_OFFERS: "marketplaceOffers",
  MARKETPLACE_OFFER_DETAIL: "marketplaceOfferDetail",
  HOUSING: "housing",
  HOUSING_RESERVATIONS: "housingReservations",
  HOUSING_RESERVATION_DETAIL: "housingReservationDetail"
} as const;

export type ManagerCapabilityRouteKey =
  (typeof MANAGER_CAPABILITY_ROUTE_KEYS)[keyof typeof MANAGER_CAPABILITY_ROUTE_KEYS];

const MANAGER_CAPABILITY_ROUTE_PATHS: Record<ManagerCapabilityRouteKey, string> = {
  marketplace: "/marketplace",
  marketplaceOffers: "/marketplace/offers",
  marketplaceOfferDetail: "/marketplace/offers/[offerId]",
  housing: "/housing",
  housingReservations: "/housing/reservations",
  housingReservationDetail: "/housing/reservations/[reservationId]"
};

export function communityBasePath(communityId: number | string): string {
  return `/communities/${communityId}`;
}

export function communityValuableActionsPath(communityId: number | string): string {
  return `/community/${communityId}/valuable-actions`;
}

export function managerCapabilityRoutePath(key: ManagerCapabilityRouteKey): string {
  return MANAGER_CAPABILITY_ROUTE_PATHS[key];
}

export function buildOverviewRoutes(communityId: number | string) {
  const base = communityBasePath(communityId);
  return {
    actions: {
      viewParameters: `${base}/parameters`,
      editParameters: `${base}/parameters/edit`,
      valuableActions: communityValuableActionsPath(communityId)
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
