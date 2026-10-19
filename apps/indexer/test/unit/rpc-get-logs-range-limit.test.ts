import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { custom, hexToBigInt, toHex } from "viem";
import { expect, test, vi } from "vitest";

import { parseRpcTuning, withGetLogsRangeLimit } from "../../src/rpc/get-logs-range-limit";

// Pattern @ponder/utils getLogsRetryHelper matches (JSON.stringify(error)) to re-chunk
// eth_getLogs into ranges of N blocks without retrying the oversized request.
const PONDER_MAX_RANGE_PATTERN = /Max range: (\d+)/;

// @ponder/utils is a dependency of @ponder/core, not of this package; resolve it next to the
// installed (patched) @ponder/core so the tests exercise the exact versions Ponder runs with.
const ponderCoreDir = fs.realpathSync(path.resolve(__dirname, "../../node_modules/@ponder/core"));
const ponderUtilsEntry = path.join(ponderCoreDir, "..", "utils", "dist", "index.js");

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

test("rpc-get-logs-range-limit: Ponder's getLogsRetryHelper re-chunks the rejection into ranges the wrapper forwards", async () => {
  const { getLogsRetryHelper } = (await import(pathToFileURL(ponderUtilsEntry).href)) as {
    getLogsRetryHelper: (args: { params: unknown[]; error: unknown }) => {
      shouldRetry: boolean;
      isSuggestedRange?: boolean;
      ranges?: { fromBlock: `0x${string}`; toBlock: `0x${string}` }[];
    };
  };
  const { request, transport } = makeTransport(10_000);
  const params = [{ address: "0x1", fromBlock: toHex(39_963_602n), toBlock: toHex(40_000_000n) }];

  const error = await transport.request({ method: "eth_getLogs", params }).catch((e: unknown) => e);
  const retry = getLogsRetryHelper({ params, error });

  expect(retry.shouldRetry).toBe(true);
  expect(retry.isSuggestedRange).toBe(true);
  const ranges = retry.ranges ?? [];
  for (const range of ranges) {
    await transport.request({ method: "eth_getLogs", params: [{ ...params[0], ...range }] });
  }
  // Every chunk reached the network, and together they cover the interval with no gaps.
  expect(request).toHaveBeenCalledTimes(ranges.length);
  expect(ranges.length).toBe(4);
  expect(hexToBigInt(ranges[0].fromBlock)).toBe(39_963_602n);
  expect(hexToBigInt(ranges[ranges.length - 1].toBlock)).toBe(40_000_000n);
  for (let i = 1; i < ranges.length; i++) {
    expect(hexToBigInt(ranges[i].fromBlock)).toBe(hexToBigInt(ranges[i - 1].toBlock) + 1n);
  }
});

test("rpc-get-logs-range-limit: the installed @ponder/core carries the historical step floor patch", () => {
  const ponderBin = fs.readFileSync(path.join(ponderCoreDir, "dist", "bin", "ponder.js"), "utf8");
  expect(ponderBin).toContain("process.env.PONDER_HISTORICAL_MIN_BLOCK_RANGE");
  expect(ponderBin).not.toContain("let estimateRange = 25;");
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
    maxRequestsPerSecond: 15,
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
