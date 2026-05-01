"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseAbiItem } from "viem";
import { getContractAddress } from "../lib/contracts";
import { listSessions } from "../lib/deploy/session-store";
import {
  readPersistentCache,
  writePersistentCache
} from "../lib/deploy/persistent-cache";
import { useCachedPublicClient, type CachedPublicClient } from "./useCachedPublicClient";

const COMMUNITY_REGISTERED_EVENT = parseAbiItem(
  "event CommunityRegistered(uint256 indexed communityId, string name, address indexed creator, uint256 parentCommunityId)"
);

const LOOKBACK_BLOCKS = 200_000n;
const CHUNK_SIZE_BLOCKS = 10_000n;
const MIN_CHUNK_SIZE_BLOCKS = 250n;
const DISCOVERY_CACHE_TTL_MS = 45_000;

function isPayloadTooLargeError(error: unknown): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("413") || message.includes("content too large") || message.includes("payload too large");
}

async function getLogsChunkedByCreator(
  publicClient: CachedPublicClient,
  chainId: number,
  deployerAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
) {
  const address = getContractAddress("communityRegistry", chainId);
  const logs: Array<{ args?: { communityId?: bigint } }> = [];

  async function fetchRangeAdaptive(start: bigint, end: bigint): Promise<void> {
    try {
      const chunkLogs = await publicClient.getLogs({
        address,
        event: COMMUNITY_REGISTERED_EVENT,
        args: { creator: deployerAddress },
        fromBlock: start,
        toBlock: end
      }, 30_000);
      logs.push(...(chunkLogs as Array<{ args?: { communityId?: bigint } }>));
      return;
    } catch (error) {
      if (!isPayloadTooLargeError(error)) {
        throw error;
      }
      const span = end - start + 1n;
      if (span <= MIN_CHUNK_SIZE_BLOCKS) {
        throw new Error("RPC_413_PAYLOAD_TOO_LARGE");
      }
      const mid = start + span / 2n;
      await fetchRangeAdaptive(start, mid - 1n);
      await fetchRangeAdaptive(mid, end);
    }
  }

  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const end = cursor + CHUNK_SIZE_BLOCKS - 1n > toBlock ? toBlock : cursor + CHUNK_SIZE_BLOCKS - 1n;
    await fetchRangeAdaptive(cursor, end);

    cursor = end + 1n;
  }

  return logs;
}

async function fetchCommunityIdsByCreator(
  publicClient: CachedPublicClient,
  deployerAddress: `0x${string}`,
  chainId: number
): Promise<number[]> {
  if (!publicClient.raw) return [];

  const cacheKey = `community-discovery:${chainId}:${deployerAddress.toLowerCase()}`;
  const cachedIds = readPersistentCache<number[]>(cacheKey);
  if (cachedIds && cachedIds.length > 0) {
    return cachedIds;
  }

  const toBlock = await publicClient.getBlockNumber(5_000);
  const fromBlock = toBlock > LOOKBACK_BLOCKS ? toBlock - LOOKBACK_BLOCKS : 0n;

  const logs = await getLogsChunkedByCreator(publicClient, chainId, deployerAddress, fromBlock, toBlock);

  const ids: number[] = [];
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const communityId = logs[i]?.args?.communityId;
    if (typeof communityId === "bigint") {
      const numericId = Number(communityId);
      if (!ids.includes(numericId)) ids.push(numericId);
    }
  }

  if (ids.length > 0) {
    writePersistentCache(cacheKey, ids, DISCOVERY_CACHE_TTL_MS);
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
  const publicClient = useCachedPublicClient();
  const [chainIds, setChainIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const inFlightRef = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return;

    if (status !== "connected" || !address) {
      setChainIds([]);
      setIsLoading(false);
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const fromChain = await fetchCommunityIdsByCreator(publicClient, address, chainId);
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      const merged = [...new Set([...fromChain, ...fromSessions])];
      setChainIds(merged);
      writePersistentCache(
        `community-discovery:${chainId}:${address.toLowerCase()}`,
        merged,
        DISCOVERY_CACHE_TTL_MS
      );
    } catch (error) {
      console.warn("[useMyDeployedCommunities] Falling back to session cache", {
        chainId,
        address,
        error: String(error)
      });
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      setChainIds(fromSessions);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
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
