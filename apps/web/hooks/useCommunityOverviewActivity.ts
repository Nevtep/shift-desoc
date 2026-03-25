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
import type { ActivityDomain, ActivityPanelState } from "../lib/community-overview/types";

function derivePanelState(args: {
  domain: ActivityDomain;
  loading: boolean;
  items: ReturnType<typeof mapOverviewActivity>;
  health: "synced" | "lagging" | "error" | "unknown";
  viewAllHref: string;
  createHref: string;
  ctasEnabled: boolean;
}): ActivityPanelState {
  const viewAll = {
    href: args.viewAllHref,
    enabled: args.ctasEnabled,
    comingSoon: !args.ctasEnabled
  };

  const create = {
    href: args.createHref,
    enabled: args.ctasEnabled,
    comingSoon: !args.ctasEnabled
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

export function useCommunityOverviewActivity(communityId: number) {
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
    () => mapOverviewActivity("requests", requests.data?.requests.nodes as Record<string, unknown>[] | undefined),
    [requests.data?.requests.nodes]
  );

  const draftItems = useMemo(
    () => mapOverviewActivity("drafts", drafts.data?.drafts.nodes as Record<string, unknown>[] | undefined),
    [drafts.data?.drafts.nodes]
  );

  const proposalItems = useMemo(
    () => mapOverviewActivity("proposals", proposals.data?.proposals.nodes as Record<string, unknown>[] | undefined),
    [proposals.data?.proposals.nodes]
  );

  const newest = newestPreviewTimestamp([requestItems, draftItems, proposalItems]);
  const health = useIndexerHealth(newest);
  const routes = buildOverviewRoutes(communityId);

  const panels = useMemo(() => {
    const loading = requests.isLoading || drafts.isLoading || proposals.isLoading;

    return {
      requests: derivePanelState({
        domain: "requests",
        loading,
        items: requestItems,
        health: health.state,
        viewAllHref: routes.previews.requests.viewAll,
        createHref: routes.previews.requests.create,
        ctasEnabled: true
      }),
      drafts: derivePanelState({
        domain: "drafts",
        loading,
        items: draftItems,
        health: health.state,
        viewAllHref: routes.previews.drafts.viewAll,
        createHref: routes.previews.drafts.create,
        ctasEnabled: true
      }),
      proposals: derivePanelState({
        domain: "proposals",
        loading,
        items: proposalItems,
        health: health.state,
        viewAllHref: routes.previews.proposals.viewAll,
        createHref: routes.previews.proposals.create,
        ctasEnabled: false
      })
    };
  }, [draftItems, drafts.isLoading, health.state, proposalItems, proposals.isLoading, requestItems, requests.isLoading, routes.previews.drafts.create, routes.previews.drafts.viewAll, routes.previews.proposals.create, routes.previews.proposals.viewAll, routes.previews.requests.create, routes.previews.requests.viewAll]);

  return {
    panels,
    health: health.state,
    refetch: () => Promise.all([requests.refetch(), drafts.refetch(), proposals.refetch(), health.refetch()])
  };
}
