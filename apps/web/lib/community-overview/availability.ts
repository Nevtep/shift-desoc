import {
  MANAGER_CAPABILITY_ROUTE_KEYS,
  buildOverviewRoutes,
  managerCapabilityRoutePath,
  type ManagerCapabilityRouteKey
} from "./routes";
import type { SectionTabState } from "./types";

const MANAGER_CAPABILITY_STATUSES = {
  OPERABLE: "operable",
  UNAVAILABLE: "unavailable"
} as const;

type ManagerCapabilityStatus =
  (typeof MANAGER_CAPABILITY_STATUSES)[keyof typeof MANAGER_CAPABILITY_STATUSES];

export type ManagerCapabilityMetadata = {
  key: ManagerCapabilityRouteKey;
  href: string;
  overviewSection: SectionTabState["key"];
  enabled: boolean;
  comingSoon: boolean;
  status: ManagerCapabilityStatus;
  requiredEvidence: string;
};

const TAB_LABELS: Array<SectionTabState["key"]> = [
  "overview",
  "coordination",
  "governance",
  "verification",
  "economy",
  "commerce"
];

const IMPLEMENTED_SECTIONS: Record<SectionTabState["key"], boolean> = {
  overview: true,
  coordination: true,
  governance: true,
  verification: false,
  economy: false,
  commerce: false
};

const LABEL_MAP: Record<SectionTabState["key"], string> = {
  overview: "Overview",
  coordination: "Coordination",
  governance: "Governance",
  verification: "Verification",
  economy: "Economy",
  commerce: "Commerce"
};

const MANAGER_CAPABILITY_FLAGS: Record<
  ManagerCapabilityRouteKey,
  Omit<ManagerCapabilityMetadata, "href">
> = {
  marketplace: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE,
    overviewSection: "economy",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Marketplace read models and Manager operator flows are not deployed."
  },
  marketplaceOffers: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFERS,
    overviewSection: "commerce",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Offer listing, creation, and detail read models are not deployed."
  },
  marketplaceOfferDetail: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFER_DETAIL,
    overviewSection: "commerce",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Offer metadata, pricing, verification stats, and settlement history are not deployed."
  },
  housing: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING,
    overviewSection: "economy",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Housing availability and reservation read models are not deployed."
  },
  housingReservations: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATIONS,
    overviewSection: "economy",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Reservation listing and operational state read models are not deployed."
  },
  housingReservationDetail: {
    key: MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATION_DETAIL,
    overviewSection: "economy",
    enabled: false,
    comingSoon: true,
    status: MANAGER_CAPABILITY_STATUSES.UNAVAILABLE,
    requiredEvidence: "Reservation timeline, payment events, and dispute status are not deployed."
  }
};

export function buildSectionTabs(communityId: number): SectionTabState[] {
  const routes = buildOverviewRoutes(communityId);

  return TAB_LABELS.map((key) => ({
    key,
    label: LABEL_MAP[key],
    href: routes.tabs[key],
    enabled: IMPLEMENTED_SECTIONS[key],
    comingSoon: !IMPLEMENTED_SECTIONS[key]
  }));
}

export function getManagerCapabilityMetadata(key: ManagerCapabilityRouteKey): ManagerCapabilityMetadata {
  return {
    ...MANAGER_CAPABILITY_FLAGS[key],
    href: managerCapabilityRoutePath(key)
  };
}
