import { hexToBigInt, isHex, type Transport } from "viem";

export type RpcTuning = {
  maxBlockRange: number;
  maxRequestsPerSecond: number;
  pollingInterval: number;
  historicalMinBlockRange: number;
};

type TuningEnv = Record<string, string | undefined> & {
  PONDER_RPC_MAX_BLOCK_RANGE?: string;
  PONDER_MAX_REQUESTS_PER_SECOND?: string;
  PONDER_POLLING_INTERVAL_MS?: string;
  PONDER_HISTORICAL_MIN_BLOCK_RANGE?: string;
};

// Defaults sized for Infura Base Sepolia, which caps eth_getLogs at 10,000 blocks. Size
// maxRequestsPerSecond to the provider plan; historical speed comes from the step floor below.
const DEFAULT_TUNING: Omit<RpcTuning, "historicalMinBlockRange"> = {
  maxBlockRange: 10_000,
  maxRequestsPerSecond: 50,
  pollingInterval: 4_000,
};

function parsePositiveInt(
  raw: string | undefined,
  name: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

export function parseRpcTuning(env: TuningEnv): RpcTuning {
  const maxBlockRange = parsePositiveInt(
    env.PONDER_RPC_MAX_BLOCK_RANGE,
    "PONDER_RPC_MAX_BLOCK_RANGE",
    DEFAULT_TUNING.maxBlockRange
  );
  return {
    maxBlockRange,
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
    // Read by the @ponder/core patch (patches/@ponder__core@0.7.17.patch). Ponder sizes each
    // historical step to take ~1s with a 25-block floor; against a ~1s-latency RPC every step
    // takes seconds, so the step pins at 25 blocks and a months-long catchup takes hundreds of
    // hours. Defaulting the floor to one getLogs chunk keeps steps at ~maxBlockRange blocks.
    // Ponder caps steps at 100,000 blocks.
    historicalMinBlockRange: parsePositiveInt(
      env.PONDER_HISTORICAL_MIN_BLOCK_RANGE,
      "PONDER_HISTORICAL_MIN_BLOCK_RANGE",
      maxBlockRange - 1,
      1,
      100_000
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
