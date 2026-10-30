"use client";

import { useMemo } from "react";
import { useChainId, useReadContract } from "wagmi";

import { parseChainEngagement, type ChainEngagement } from "../lib/engagements/chain-state";
import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "./useCommunityModules";

type Params = {
  communityId: number;
  engagementId: number;
  enabled: boolean;
};

/** Reads `Engagements.getEngagement` from the community's Engagements module. */
export function useEngagementChainState({ communityId, engagementId, enabled }: Params) {
  const chainId = useChainId();
  const { modules } = useCommunityModules({ communityId, chainId, enabled });
  const address = modules?.engagementsManager;

  const query = useReadContract({
    address,
    abi: COMMUNITY_MODULE_ABIS.engagements,
    functionName: "getEngagement",
    args: [BigInt(engagementId)],
    query: { enabled: enabled && Boolean(address) }
  });

  const chain: ChainEngagement | null = useMemo(() => parseChainEngagement(query.data), [query.data]);
  return { chain, isLoading: query.isLoading, isError: query.isError };
}
