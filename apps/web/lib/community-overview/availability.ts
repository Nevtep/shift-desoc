import { buildOverviewRoutes } from "./routes";
import type { SectionTabState } from "./types";

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
