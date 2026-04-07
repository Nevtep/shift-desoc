export type IndexerHealthState = "synced" | "lagging" | "error" | "unknown";

export type OverviewActionState = {
  href: string;
  enabled: boolean;
  comingSoon?: boolean;
  external?: boolean;
};

export type OverviewHeaderState = {
  communityId: number;
  displayName: string;
  network: string;
  environment: string;
  health: IndexerHealthState;
  lastCheckedAt: string;
  actions: {
    viewParameters: OverviewActionState;
    editParameters: OverviewActionState;
  };
};

export type ModuleSummaryStatus = "present" | "missing";

export type ModuleSummaryItem = {
  moduleKey: string;
  label: string;
  address: string | null;
  shortAddress: string;
  hasCode: boolean;
  status: ModuleSummaryStatus;
  source: "on-chain verified" | "unavailable" | "EOA treasury vault" | "contract treasury vault";
};

export type ParameterUnit = "seconds" | "bps" | "integer threshold";

export type ParameterSummaryItem = {
  id: string;
  label: string;
  unit: ParameterUnit;
  value: string;
  rawValue: string | null;
  source: "on-chain verified" | "unavailable";
  lastCheckedAt: string;
};

export type ActivityDomain = "requests" | "drafts" | "proposals";

export type ActivityPreviewItem = {
  domain: ActivityDomain;
  id: string;
  titleOrIdentifier: string;
  status: string;
  timestamp: string;
};

export type ActivityPanelState = {
  domain: ActivityDomain;
  state: "loading" | "ready" | "empty" | "error" | "lagging";
  items: ActivityPreviewItem[];
  canRetry: boolean;
  viewAll: OverviewActionState;
  create: OverviewActionState;
};

export type SectionTabState = {
  key: "overview" | "coordination" | "governance" | "verification" | "economy" | "commerce";
  label: string;
  href: string;
  enabled: boolean;
  comingSoon: boolean;
};
