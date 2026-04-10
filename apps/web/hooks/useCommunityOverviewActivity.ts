"use client";

import { useMemo } from "react";

import { useGraphQLQuery } from "./useGraphQLQuery";
import { useIndexerHealth } from "./useIndexerHealth";
import {
  CommunityOverviewDraftsQuery,
  CommunityOverviewProposalsQuery,
  CommunityOverviewRequestsQuery,
  type CommunityOverviewDraftsResult,
  type CommunityOverviewProposalsResult,
  type CommunityOverviewRequestsResult
} from "../lib/graphql/queries";
import { buildOverviewActivityQueryVariables, mapOverviewActivity, newestPreviewTimestamp } from "../lib/community-overview/activity";
import { buildOverviewRoutes } from "../lib/community-overview/routes";
import type { ActivityDomain, ActivityPanelState, IndexerHealthState } from "../lib/community-overview/types";

type ActivityHealthOverrides = {
  state?: IndexerHealthState;
  refetch?: () => Promise<unknown>;
};

function pickNodes(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as { nodes?: unknown; items?: unknown };
  if (Array.isArray(obj.nodes)) return obj.nodes as Record<string, unknown>[];
  if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
  return [];
}

function derivePanelState(args: {
  domain: ActivityDomain;
  loading: boolean;
  queryError: boolean;
  items: ReturnType<typeof mapOverviewActivity>;
  health: "synced" | "lagging" | "error" | "unknown";
  viewAllHref: string;
  createHref: string;
  viewAllEnabled: boolean;
  createEnabled: boolean;
}): ActivityPanelState {
  const viewAll = {
    href: args.viewAllHref,
    enabled: args.viewAllEnabled,
    comingSoon: !args.viewAllEnabled
  };

  const create = {
    href: args.createHref,
    enabled: args.createEnabled,
    comingSoon: !args.createEnabled
  };

  if (args.loading) {
    return {
      domain: args.domain,
      state: "loading",
      items: [],
      canRetry: false,
      viewAll,
      create
    };
  }

  if (args.queryError) {
    return {
      domain: args.domain,
      state: "error",
      items: [],
      canRetry: true,
      viewAll,
      create
    };
  }

  if (args.health === "error") {
    return {
      domain: args.domain,
      state: "error",
      items: [],
      canRetry: true,
      viewAll,
      create
    };
  }

  if (args.health === "lagging") {
    return {
      domain: args.domain,
      state: "lagging",
      items: args.items,
      canRetry: true,
      viewAll,
      create
    };
  }

  if (!args.items.length) {
    return {
      domain: args.domain,
      state: "empty",
      items: [],
      canRetry: false,
      viewAll,
      create
    };
  }

  return {
    domain: args.domain,
    state: "ready",
    items: args.items,
    canRetry: false,
    viewAll,
    create
  };
}

export function useCommunityOverviewActivity(communityId: number, healthOverrides?: ActivityHealthOverrides) {
  const variables = buildOverviewActivityQueryVariables(communityId);
  const enabled = communityId > 0;

  const requests = useGraphQLQuery<CommunityOverviewRequestsResult, typeof variables>(
    ["community-overview", "requests", communityId],
    CommunityOverviewRequestsQuery,
    variables,
    { enabled }
  );

  const drafts = useGraphQLQuery<CommunityOverviewDraftsResult, typeof variables>(
    ["community-overview", "drafts", communityId],
    CommunityOverviewDraftsQuery,
    variables,
    { enabled }
  );

  const proposals = useGraphQLQuery<CommunityOverviewProposalsResult, typeof variables>(
    ["community-overview", "proposals", communityId],
    CommunityOverviewProposalsQuery,
    variables,
    { enabled }
  );

  const requestItems = useMemo(
    () => mapOverviewActivity("requests", pickNodes(requests.data?.requests)),
    [requests.data?.requests]
  );

  const draftItems = useMemo(
    () => mapOverviewActivity("drafts", pickNodes(drafts.data?.drafts)),
    [drafts.data?.drafts]
  );

  const proposalItems = useMemo(
    () => mapOverviewActivity("proposals", pickNodes(proposals.data?.proposals)),
    [proposals.data?.proposals]
  );

  const newest = newestPreviewTimestamp([requestItems, draftItems, proposalItems]);
  const health = useIndexerHealth(newest);
  const healthState = healthOverrides?.state ?? health.state;
  const refetchHealth = healthOverrides?.refetch ?? health.refetch;
  const routes = buildOverviewRoutes(communityId);

  const panels = useMemo(() => {
    const loading = requests.isLoading || drafts.isLoading || proposals.isLoading;

    return {
      requests: derivePanelState({
        domain: "requests",
        loading,
        queryError: requests.isError,
        items: requestItems,
        health: healthState,
        viewAllHref: routes.previews.requests.viewAll,
        createHref: routes.previews.requests.create,
        viewAllEnabled: true,
        createEnabled: true
      }),
      drafts: derivePanelState({
        domain: "drafts",
        loading,
        queryError: drafts.isError,
        items: draftItems,
        health: healthState,
        viewAllHref: routes.previews.drafts.viewAll,
        createHref: routes.previews.drafts.create,
        viewAllEnabled: true,
        createEnabled: true
      }),
      proposals: derivePanelState({
        domain: "proposals",
        loading,
        queryError: proposals.isError,
        items: proposalItems,
        health: healthState,
        viewAllHref: routes.previews.proposals.viewAll,
        createHref: routes.previews.proposals.create,
        viewAllEnabled: true,
        createEnabled: true
      })
    };
  }, [draftItems, drafts.isError, drafts.isLoading, healthState, proposalItems, proposals.isError, proposals.isLoading, requestItems, requests.isError, requests.isLoading, routes.previews.drafts.create, routes.previews.drafts.viewAll, routes.previews.proposals.create, routes.previews.proposals.viewAll, routes.previews.requests.create, routes.previews.requests.viewAll]);

  return {
    panels,
    health: healthState,
    refetch: () => Promise.all([requests.refetch(), drafts.refetch(), proposals.refetch(), refetchHealth()])
  };
}
