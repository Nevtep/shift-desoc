"use client";

import { useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";

import { getContractConfig } from "../lib/contracts";
import { useCachedPublicClient } from "./useCachedPublicClient";

/**
 * Community name as registered on-chain (CommunityRegistry.getCommunity).
 * The contract is the source of truth; the indexer is only a derived copy.
 * Returns null while loading or when the read fails.
 */
export function useCommunityName(communityId: number): string | null {
  const chainId = useChainId();
  const publicClient = useCachedPublicClient();
  const [loaded, setLoaded] = useState<{ id: number; name: string | null }>({ id: communityId, name: null });

  const registry = useMemo(() => {
    try {
      return getContractConfig("communityRegistry", chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  useEffect(() => {
    if (!registry || !publicClient.raw || !Number.isFinite(communityId) || communityId <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await publicClient.readContract({
          address: registry.address,
          abi: registry.abi,
          functionName: "getCommunity",
          args: [BigInt(communityId)]
        })) as { name?: string } | undefined;
        if (!cancelled) setLoaded({ id: communityId, name: data?.name?.trim() || null });
      } catch {
        if (!cancelled) setLoaded({ id: communityId, name: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, registry, publicClient]);

  return loaded.id === communityId ? loaded.name : null;
}
