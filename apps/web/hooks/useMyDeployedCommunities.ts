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
// Discovery is a convenience hint, never a precondition for creating a community. Whatever the RPC does,
// the check resolves (with the session cache as fallback) within this budget.
export const DISCOVERY_DEADLINE_MS = 9_000;
// After a timeout or an RPC error the hook keeps the session-cache fallback, then re-checks quietly in the
// background so the hint recovers on its own once the RPC is back. Bounded: one retry per entry, then stop.
export const DISCOVERY_RETRY_DELAYS_MS = [15_000, 30_000, 60_000] as const;

class DiscoveryCancelledError extends Error {
  constructor() {
    super("COMMUNITY_DISCOVERY_CANCELLED");
  }
}

type ScanControl = { cancelled: boolean };

function raceDeadline<T>(work: Promise<T>, ms: number, onDeadline: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onDeadline();
      reject(new Error("COMMUNITY_DISCOVERY_DEADLINE"));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isPayloadTooLargeError(error: unknown): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("413") || message.includes("content too large") || message.includes("payload too large");
}

async function getLogsChunkedByCreator(
  publicClient: CachedPublicClient,
  chainId: number,
  deployerAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  control: ScanControl
) {
  const address = getContractAddress("communityRegistry", chainId);
  const logs: Array<{ args?: { communityId?: bigint } }> = [];

  async function fetchRangeAdaptive(start: bigint, end: bigint): Promise<void> {
    if (control.cancelled) throw new DiscoveryCancelledError();
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
    if (control.cancelled) throw new DiscoveryCancelledError();
    const end = cursor + CHUNK_SIZE_BLOCKS - 1n > toBlock ? toBlock : cursor + CHUNK_SIZE_BLOCKS - 1n;
    await fetchRangeAdaptive(cursor, end);

    cursor = end + 1n;
  }

  return logs;
}

async function fetchCommunityIdsByCreator(
  publicClient: CachedPublicClient,
  deployerAddress: `0x${string}`,
  chainId: number,
  control: ScanControl
): Promise<number[]> {
  if (!publicClient.raw) return [];

  const cacheKey = `community-discovery:${chainId}:${deployerAddress.toLowerCase()}`;
  const cachedIds = readPersistentCache<number[]>(cacheKey);
  if (cachedIds && cachedIds.length > 0) {
    return cachedIds;
  }

  const toBlock = await publicClient.getBlockNumber(5_000);
  const fromBlock = toBlock > LOOKBACK_BLOCKS ? toBlock - LOOKBACK_BLOCKS : 0n;

  const logs = await getLogsChunkedByCreator(publicClient, chainId, deployerAddress, fromBlock, toBlock, control);

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
  // The scan whose result may still be applied. Unmount (or a newer scan) supersedes it.
  const activeScanRef = useRef<ScanControl | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const refetchRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => {});

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRetryTimer();
      if (activeScanRef.current) activeScanRef.current.cancelled = true;
      activeScanRef.current = null;
      inFlightRef.current = false;
    };
  }, [clearRetryTimer]);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    if (inFlightRef.current) return;
    clearRetryTimer();

    if (status !== "connected" || !address) {
      setChainIds([]);
      setIsLoading(false);
      return;
    }

    inFlightRef.current = true;
    // Background retries stay quiet: the entry point never goes back to a "checking" state.
    if (!options?.silent) setIsLoading(true);
    const control: ScanControl = { cancelled: false };
    activeScanRef.current = control;
    try {
      const fromChain = await raceDeadline(
        fetchCommunityIdsByCreator(publicClient, address, chainId, control),
        DISCOVERY_DEADLINE_MS,
        () => {
          // Stop issuing further sequential getLogs requests once the budget is spent.
          control.cancelled = true;
        }
      );
      if (activeScanRef.current !== control) return;
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      const merged = [...new Set([...fromChain, ...fromSessions])];
      setChainIds(merged);
      retryAttemptRef.current = 0;
      writePersistentCache(
        `community-discovery:${chainId}:${address.toLowerCase()}`,
        merged,
        DISCOVERY_CACHE_TTL_MS
      );
    } catch (error) {
      control.cancelled = true;
      if (activeScanRef.current !== control) return;
      console.warn("[useMyDeployedCommunities] Falling back to session cache", {
        chainId,
        address,
        error: String(error)
      });
      const fromSessions = getCompletedCommunityIdsFromSessions(address, chainId);
      setChainIds(fromSessions);
      const delay = DISCOVERY_RETRY_DELAYS_MS[retryAttemptRef.current];
      if (delay !== undefined) {
        retryAttemptRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          void refetchRef.current({ silent: true });
        }, delay);
      }
    } finally {
      if (activeScanRef.current === control) {
        setIsLoading(false);
        activeScanRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, [address, chainId, clearRetryTimer, publicClient, status]);

  refetchRef.current = refetch;

  useEffect(() => {
    retryAttemptRef.current = 0;
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      retryAttemptRef.current = 0;
      void refetchRef.current({ silent: true });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const communityIds = chainIds;
  const hasCommunities = communityIds.length > 0;

  return {
    communityIds,
    hasCommunities,
    isLoading,
    refetch
  };
}
