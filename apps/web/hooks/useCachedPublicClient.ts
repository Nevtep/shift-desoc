"use client";

import { useMemo } from "react";
import { useChainId, usePublicClient } from "wagmi";
import type { PublicClient } from "viem";

import { getOrFetchPersistentCache } from "../lib/deploy/persistent-cache";

type CacheTtlByMethod = {
  getBalance: number;
  getBlockNumber: number;
  getBytecode: number;
  readContract: number;
  getLogs: number;
};

export type CachedPublicClient = {
  raw: PublicClient | undefined;
  getBalance: (args: { address: `0x${string}` }, ttlMs?: number) => Promise<bigint>;
  getBlockNumber: (ttlMs?: number) => Promise<bigint>;
  getBytecode: (args: { address: `0x${string}` }, ttlMs?: number) => Promise<`0x${string}` | undefined>;
  readContract: <T = unknown>(
    args: {
      address: `0x${string}`;
      abi: any;
      functionName: string;
      args?: readonly unknown[];
    },
    ttlMs?: number
  ) => Promise<T>;
  getLogs: <T = unknown>(
    args: {
      address: `0x${string}`;
      event?: any;
      args?: Record<string, unknown>;
      fromBlock?: bigint;
      toBlock?: bigint;
    },
    ttlMs?: number
  ) => Promise<T[]>;
};

const DEFAULT_TTL_MS: CacheTtlByMethod = {
  getBalance: 10_000,
  getBlockNumber: 5_000,
  getBytecode: 30_000,
  readContract: 20_000,
  getLogs: 30_000,
};

const inFlight = new Map<string, Promise<unknown>>();

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") {
      return { __type: "bigint", value: v.toString() };
    }

    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }

    return v;
  });
}

async function getCached<T>(
  chainId: number,
  method: keyof CacheTtlByMethod,
  args: unknown,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = `rpc:${chainId}:${method}:${stableSerialize(args)}`;

  const pending = inFlight.get(key);
  if (pending) return (await pending) as T;

  const promise = getOrFetchPersistentCache<T>(key, ttlMs, fetcher);
  inFlight.set(key, promise as Promise<unknown>);

  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function useCachedPublicClient(): CachedPublicClient {
  const raw = usePublicClient();
  const chainId = useChainId();

  return useMemo(() => {
    return {
      raw,
      getBalance: async (args, ttlMs = DEFAULT_TTL_MS.getBalance) => {
        if (!raw) return 0n;
        return getCached(chainId, "getBalance", args, ttlMs, async () => raw.getBalance(args));
      },
      getBlockNumber: async (ttlMs = DEFAULT_TTL_MS.getBlockNumber) => {
        if (!raw) return 0n;
        return getCached(chainId, "getBlockNumber", {}, ttlMs, async () => raw.getBlockNumber());
      },
      getBytecode: async (args, ttlMs = DEFAULT_TTL_MS.getBytecode) => {
        if (!raw) return undefined;
        return getCached(chainId, "getBytecode", args, ttlMs, async () => raw.getBytecode(args));
      },
      readContract: async <T = unknown>(args: {
        address: `0x${string}`;
        abi: any;
        functionName: string;
        args?: readonly unknown[];
      }, ttlMs = DEFAULT_TTL_MS.readContract) => {
        if (!raw) throw new Error("Public client unavailable");
        return getCached(chainId, "readContract", {
          address: args.address,
          functionName: args.functionName,
          args: args.args
        }, ttlMs, async () => raw.readContract(args as any) as Promise<T>);
      },
      getLogs: async <T = unknown>(args: {
        address: `0x${string}`;
        event?: any;
        args?: Record<string, unknown>;
        fromBlock?: bigint;
        toBlock?: bigint;
      }, ttlMs = DEFAULT_TTL_MS.getLogs) => {
        if (!raw) return [];
        return getCached(chainId, "getLogs", {
          address: args.address,
          fromBlock: args.fromBlock,
          toBlock: args.toBlock,
          args: args.args
        }, ttlMs, async () => raw.getLogs(args as any) as Promise<T[]>);
      }
    };
  }, [raw, chainId]);
}
