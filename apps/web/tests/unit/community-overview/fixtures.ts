import type {
  ActivityPanelState,
  ActivityPreviewItem,
  IndexerHealthState,
  ModuleSummaryItem,
  ParameterSummaryItem,
  SectionTabState
} from "../../../lib/community-overview/types";

export function makeModule(overrides: Partial<ModuleSummaryItem> = {}): ModuleSummaryItem {
  return {
    moduleKey: "governor",
    label: "Governor",
    address: "0x0000000000000000000000000000000000000100",
    shortAddress: "0x0000...0100",
    hasCode: true,
    status: "present",
    source: "on-chain verified",
    ...overrides
  };
}

export function makeParameter(overrides: Partial<ParameterSummaryItem> = {}): ParameterSummaryItem {
  return {
    id: "governance.debateWindow",
    label: "Governance debate window",
    unit: "seconds",
    value: "10m (600 sec)",
    rawValue: "600",
    source: "on-chain verified",
    lastCheckedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...overrides
  };
}

export function makeActivityItem(overrides: Partial<ActivityPreviewItem> = {}): ActivityPreviewItem {
  return {
    domain: "requests",
    id: "1",
    titleOrIdentifier: "request-cid-1",
    status: "OPEN",
    timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...overrides
  };
}

export function makeActivityPanel(overrides: Partial<ActivityPanelState> = {}): ActivityPanelState {
  return {
    domain: "requests",
    state: "ready",
    items: [makeActivityItem()],
    canRetry: false,
    viewAll: {
      href: "/communities/1/coordination/requests",
      enabled: true
    },
    create: {
      href: "/communities/1/coordination/requests/new",
      enabled: true
    },
    ...overrides
  };
}

export function makeTabs(communityId = 1): SectionTabState[] {
  return [
    { key: "overview", label: "Overview", href: `/communities/${communityId}`, enabled: true, comingSoon: false },
    { key: "coordination", label: "Coordination", href: `/communities/${communityId}/coordination`, enabled: true, comingSoon: false },
    { key: "governance", label: "Governance", href: `/communities/${communityId}/governance`, enabled: true, comingSoon: false },
    { key: "verification", label: "Verification", href: `/communities/${communityId}/verification`, enabled: false, comingSoon: true },
    { key: "economy", label: "Economy", href: `/communities/${communityId}/economy`, enabled: false, comingSoon: true },
    { key: "commerce", label: "Commerce", href: `/communities/${communityId}/commerce`, enabled: false, comingSoon: true }
  ];
}

export function makeIndexerHealth(state: IndexerHealthState = "synced"): IndexerHealthState {
  return state;
}
