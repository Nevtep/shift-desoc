export type EngagementReadinessStatus = "healthy" | "lagging" | "unavailable";

export type EngagementReadiness = {
  status: EngagementReadinessStatus;
  indexedBlock: string | null;
  chainHeadBlock: string | null;
  blockLag: string | null;
  indexedAt: string | null;
  details: string;
};

// ~200s of Base blocks (2s each); beyond this the Manager must say the projection is lagging.
export const ENGAGEMENT_READINESS_LAG_BLOCKS = 100;

const FETCH_TIMEOUT_MS = 3_000;

export type DeriveEngagementReadinessInput = {
  /** Block the indexer itself has processed up to (ponder sync checkpoint), null if unknown. */
  indexedBlock: bigint | null;
  /** Current chain head from the RPC, null if unreachable. */
  chainHeadBlock: bigint | null;
  /** Timestamp of the latest engagement/juror projection write for the community, null if none. */
  latestActivityAt: Date | null;
};

export function deriveEngagementReadiness(input: DeriveEngagementReadinessInput): EngagementReadiness {
  const { indexedBlock, chainHeadBlock, latestActivityAt } = input;
  const base = {
    indexedBlock: indexedBlock === null ? null : indexedBlock.toString(),
    chainHeadBlock: chainHeadBlock === null ? null : chainHeadBlock.toString(),
    indexedAt: latestActivityAt ? latestActivityAt.toISOString() : null,
  };

  if (indexedBlock === null || chainHeadBlock === null) {
    return {
      ...base,
      status: "unavailable",
      blockLag: null,
      details: "Indexer progress or chain head could not be determined.",
    };
  }

  const lag = chainHeadBlock > indexedBlock ? chainHeadBlock - indexedBlock : 0n;
  const lagging = lag > BigInt(ENGAGEMENT_READINESS_LAG_BLOCKS);
  return {
    ...base,
    status: lagging ? "lagging" : "healthy",
    blockLag: lag.toString(),
    details: lagging
      ? `Indexer is ${lag} blocks behind the chain head.`
      : "Indexer is caught up with the chain head.",
  };
}

type FetchLike = typeof fetch;

/** Reads the indexed block for `network` from ponder's built-in GET /status. */
export async function fetchIndexedBlock(
  statusUrl: string,
  network: string,
  fetchImpl: FetchLike = fetch
): Promise<bigint | null> {
  try {
    const res = await fetchImpl(statusUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, { block?: { number?: number } } | undefined>;
    const num = body?.[network]?.block?.number;
    return typeof num === "number" && Number.isFinite(num) && num >= 0 ? BigInt(num) : null;
  } catch {
    return null;
  }
}

export async function fetchChainHeadBlock(rpcUrl: string, fetchImpl: FetchLike = fetch): Promise<bigint | null> {
  try {
    const res = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return typeof body.result === "string" && /^0x[0-9a-fA-F]+$/.test(body.result) ? BigInt(body.result) : null;
  } catch {
    return null;
  }
}
