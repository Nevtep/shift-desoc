"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { parseAbiItem, type PublicClient } from "viem";
import { getContractAddress } from "../lib/contracts";
import { listSessions } from "../lib/deploy/session-store";

async function fetchCommunityIdsByCreator(
  publicClient: PublicClient | undefined,
  deployerAddress: `0x${string}`,
  chainId: number
): Promise<number[]> {
  if (!publicClient) return [];

  const toBlock = await publicClient.getBlockNumber();
  const fromBlock = toBlock > 500_000n ? toBlock - 500_000n : 0n;

  const logs = await publicClient.getLogs({
    address: getContractAddress("communityRegistry", chainId),
    event: parseAbiItem(
      "event CommunityRegistered(uint256 indexed communityId, string name, address indexed creator, uint256 parentCommunityId)"
    ),
    args: { creator: deployerAddress },
    fromBlock,
    toBlock
  });

  const ids: number[] = [];
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const communityId = logs[i]?.args?.communityId;
    if (typeof communityId === "bigint") {
      const numericId = Number(communityId);
      if (!ids.includes(numericId)) ids.push(numericId);
    }
  }
  return ids;
}

function getCompletedCommunityIdsFromSessions(
  deployerAddress: `0x${string}`,
  chainId: number
): number[] {
  if (typeof window === "undefined") return [];
  const normalized = deployerAddress.toLowerCase();
  const sessions = listSessions();
  const ids: number[] = [];
  for (const s of sessions) {
    if (s.deployerAddress.toLowerCase() !== normalized) continue;
    if (s.chainId !== chainId) continue;
    if (s.status === "completed" && typeof s.communityId === "number" && !ids.includes(s.communityId)) {
      ids.push(s.communityId);
    }
  }
  return ids;
}

export function useMyDeployedCommunities() {
  const { address, status } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [chainIds, setChainIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (status !== "connected" || !address) {
      setChainIds([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fromChain = await fetchCommunityIdsByCreator(publicClient ?? undefined, address, chainId);
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      const merged = [...new Set([...fromChain, ...fromSessions])];
      setChainIds(merged);
    } catch {
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      setChainIds(fromSessions);
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, publicClient, status]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const communityIds = chainIds;
  const hasCommunities = communityIds.length > 0;

  return {
    communityIds,
    hasCommunities,
    isLoading,
    refetch
  };
}
