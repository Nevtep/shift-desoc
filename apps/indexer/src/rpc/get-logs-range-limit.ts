import { hexToBigInt, isHex, type Transport } from "viem";

export type RpcTuning = {
  maxBlockRange: number;
  maxRequestsPerSecond: number;
  pollingInterval: number;
};

type TuningEnv = Record<string, string | undefined> & {
  PONDER_RPC_MAX_BLOCK_RANGE?: string;
  PONDER_MAX_REQUESTS_PER_SECOND?: string;
  PONDER_POLLING_INTERVAL_MS?: string;
};

// Defaults sized for Infura Base Sepolia, which caps eth_getLogs at 10,000 blocks.
// Do not lower maxRequestsPerSecond to "protect" the RPC: Ponder 0.7 sizes each historical
// step to take ~1s and issues ~one eth_getLogs per source per step (~15 for Shift), so below
// roughly 20-50 req/s every step runs long, the step shrinks to its 25-block floor, and the
// catchup never finishes. Throughput must come from the RPC plan instead.
const DEFAULT_TUNING: RpcTuning = {
  maxBlockRange: 10_000,
  maxRequestsPerSecond: 50,
  pollingInterval: 4_000,
};

function parsePositiveInt(raw: string | undefined, name: string, fallback: number, min = 1): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`Invalid ${name}: expected an integer >= ${min}, got "${raw}"`);
  }
  return value;
}

export function parseRpcTuning(env: TuningEnv): RpcTuning {
  return {
    maxBlockRange: parsePositiveInt(env.PONDER_RPC_MAX_BLOCK_RANGE, "PONDER_RPC_MAX_BLOCK_RANGE", DEFAULT_TUNING.maxBlockRange),
    maxRequestsPerSecond: parsePositiveInt(
      env.PONDER_MAX_REQUESTS_PER_SECOND,
      "PONDER_MAX_REQUESTS_PER_SECOND",
      DEFAULT_TUNING.maxRequestsPerSecond
    ),
    // Ponder rejects polling intervals below 100ms.
    pollingInterval: parsePositiveInt(
      env.PONDER_POLLING_INTERVAL_MS,
      "PONDER_POLLING_INTERVAL_MS",
      DEFAULT_TUNING.pollingInterval,
      100
    ),
  };
}

/**
 * Ponder 0.7 first requests a whole historical interval in one eth_getLogs and only
 * re-chunks when @ponder/utils getLogsRetryHelper recognises the provider's error. Infura's
 * "range N exceeds limit of 10000" is not one of its patterns, so the sync crashes. This
 * wrapper rejects oversized ranges locally (no network call) with the "Max range: N" form the
 * helper does recognise; Ponder then chunks to N blocks and remembers it as the confirmed range.
 */
export function withGetLogsRangeLimit(transport: Transport, maxBlockRange: number): Transport {
  return (options) => {
    const inner = transport(options);
    return {
      ...inner,
      async request(args) {
        if (args.method === "eth_getLogs") {
          const [filter] = (args.params ?? []) as [{ fromBlock?: unknown; toBlock?: unknown }?];
          if (filter && isHex(filter.fromBlock) && isHex(filter.toBlock)) {
            const span = hexToBigInt(filter.toBlock) - hexToBigInt(filter.fromBlock);
            if (span >= BigInt(maxBlockRange)) {
              const message = `Max range: ${maxBlockRange}`;
              // Ponder matches against JSON.stringify(error), which skips Error#message.
              throw Object.assign(new Error(message), { details: message });
            }
          }
        }
        return inner.request(args);
      },
    } as ReturnType<Transport>;
  };
}
