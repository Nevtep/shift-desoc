import { custom } from "viem";
import { expect, test, vi } from "vitest";

import { parseRpcTuning, withGetLogsRangeLimit } from "../../src/rpc/get-logs-range-limit";

// Pattern @ponder/utils getLogsRetryHelper matches (JSON.stringify(error)) to re-chunk
// eth_getLogs into ranges of N blocks without retrying the oversized request.
const PONDER_MAX_RANGE_PATTERN = /Max range: (\d+)/;

function makeTransport(maxBlockRange: number) {
  const request = vi.fn(async () => []);
  const transport = withGetLogsRangeLimit(custom({ request }), maxBlockRange)({ retryCount: 0 });
  return { request, transport };
}

test("rpc-get-logs-range-limit: rejects an oversized eth_getLogs locally with a Ponder-parsable error", async () => {
  const { request, transport } = makeTransport(10_000);

  const error = await transport
    .request({ method: "eth_getLogs", params: [{ fromBlock: "0x0", toBlock: "0x2710" }] })
    .then(
      () => null,
      (e: unknown) => e
    );

  expect(error).not.toBeNull();
  expect(JSON.stringify(error)).toMatch(PONDER_MAX_RANGE_PATTERN);
  expect(JSON.stringify(error).match(PONDER_MAX_RANGE_PATTERN)?.[1]).toBe("10000");
  expect(request).not.toHaveBeenCalled();
});

test("rpc-get-logs-range-limit: forwards eth_getLogs within the limit", async () => {
  const { request, transport } = makeTransport(10_000);

  await transport.request({ method: "eth_getLogs", params: [{ fromBlock: "0x0", toBlock: "0x270f" }] });

  expect(request).toHaveBeenCalledTimes(1);
});

test("rpc-get-logs-range-limit: forwards other methods and non-hex getLogs untouched", async () => {
  const { request, transport } = makeTransport(10);

  await transport.request({ method: "eth_blockNumber" });
  await transport.request({ method: "eth_getLogs", params: [{ blockHash: "0xabc" }] });
  await transport.request({ method: "eth_getLogs", params: [{ fromBlock: "0x0", toBlock: "latest" }] });

  expect(request).toHaveBeenCalledTimes(3);
});

test("rpc-get-logs-range-limit: parses tuning env with throughput-safe defaults", () => {
  // The historical step floor defaults to one getLogs chunk (span maxBlockRange - 1).
  expect(parseRpcTuning({})).toEqual({
    maxBlockRange: 10_000,
    maxRequestsPerSecond: 50,
    pollingInterval: 4_000,
    historicalMinBlockRange: 9_999,
  });
  expect(
    parseRpcTuning({
      PONDER_RPC_MAX_BLOCK_RANGE: "2000",
      PONDER_MAX_REQUESTS_PER_SECOND: "5",
      PONDER_POLLING_INTERVAL_MS: "8000",
      PONDER_HISTORICAL_MIN_BLOCK_RANGE: "500",
    })
  ).toEqual({ maxBlockRange: 2_000, maxRequestsPerSecond: 5, pollingInterval: 8_000, historicalMinBlockRange: 500 });
  expect(parseRpcTuning({ PONDER_RPC_MAX_BLOCK_RANGE: "2000" }).historicalMinBlockRange).toBe(1_999);
});

test("rpc-get-logs-range-limit: fails fast on invalid tuning env", () => {
  expect(() => parseRpcTuning({ PONDER_RPC_MAX_BLOCK_RANGE: "0" })).toThrow("Invalid PONDER_RPC_MAX_BLOCK_RANGE");
  expect(() => parseRpcTuning({ PONDER_MAX_REQUESTS_PER_SECOND: "abc" })).toThrow(
    "Invalid PONDER_MAX_REQUESTS_PER_SECOND"
  );
  expect(() => parseRpcTuning({ PONDER_POLLING_INTERVAL_MS: "50" })).toThrow("Invalid PONDER_POLLING_INTERVAL_MS");
  expect(() => parseRpcTuning({ PONDER_HISTORICAL_MIN_BLOCK_RANGE: "200000" })).toThrow(
    "Invalid PONDER_HISTORICAL_MIN_BLOCK_RANGE"
  );
});
