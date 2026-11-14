import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_READINESS_LAG_BLOCKS,
  deriveEngagementReadiness,
  fetchChainHeadBlock,
  fetchIndexedBlock,
} from "../../src/engagements/readiness";

const activityAt = new Date("2026-01-01T00:00:00Z");

describe("engagement readiness derivation", () => {
  it("is healthy when indexed block is within the lag budget", () => {
    const r = deriveEngagementReadiness({ indexedBlock: 990n, chainHeadBlock: 1000n, latestActivityAt: activityAt });
    expect(r).toMatchObject({
      status: "healthy",
      indexedBlock: "990",
      chainHeadBlock: "1000",
      blockLag: "10",
      indexedAt: activityAt.toISOString(),
    });
  });

  it("is lagging with a real (non-zero) block lag beyond the budget", () => {
    const head = 10_000n;
    const r = deriveEngagementReadiness({
      indexedBlock: head - BigInt(ENGAGEMENT_READINESS_LAG_BLOCKS) - 1n,
      chainHeadBlock: head,
      latestActivityAt: null,
    });
    expect(r.status).toBe("lagging");
    expect(r.blockLag).toBe(String(ENGAGEMENT_READINESS_LAG_BLOCKS + 1));
    expect(r.indexedAt).toBeNull();
  });

  it("treats exactly the budget as healthy", () => {
    const r = deriveEngagementReadiness({
      indexedBlock: 100n,
      chainHeadBlock: 100n + BigInt(ENGAGEMENT_READINESS_LAG_BLOCKS),
      latestActivityAt: null,
    });
    expect(r.status).toBe("healthy");
  });

  it("is unavailable when either block cannot be determined", () => {
    expect(deriveEngagementReadiness({ indexedBlock: null, chainHeadBlock: 5n, latestActivityAt: null })).toMatchObject({
      status: "unavailable",
      blockLag: null,
      indexedBlock: null,
      chainHeadBlock: "5",
    });
    expect(deriveEngagementReadiness({ indexedBlock: 5n, chainHeadBlock: null, latestActivityAt: null }).status).toBe(
      "unavailable"
    );
  });

  it("never reports a negative lag when the indexer is ahead of the sampled head", () => {
    const r = deriveEngagementReadiness({ indexedBlock: 12n, chainHeadBlock: 10n, latestActivityAt: null });
    expect(r.status).toBe("healthy");
    expect(r.blockLag).toBe("0");
  });
});

describe("engagement readiness sources", () => {
  it("reads the indexed block from the ponder /status payload for the configured network", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ base_sepolia: { id: 84532, block: { number: 321, timestamp: 1 } } }));
    expect(await fetchIndexedBlock("http://x/status", "base_sepolia", fetchImpl as typeof fetch)).toBe(321n);
    expect(await fetchIndexedBlock("http://x/status", "base", fetchImpl as typeof fetch)).toBeNull();
  });

  it("returns null when the status endpoint fails", async () => {
    const boom = async () => {
      throw new Error("down");
    };
    expect(await fetchIndexedBlock("http://x/status", "base", boom as unknown as typeof fetch)).toBeNull();
    const notOk = async () => new Response("no", { status: 503 });
    expect(await fetchIndexedBlock("http://x/status", "base", notOk as typeof fetch)).toBeNull();
  });

  it("reads the chain head via eth_blockNumber and tolerates RPC failure", async () => {
    const ok = async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x10" }));
    expect(await fetchChainHeadBlock("http://rpc", ok as typeof fetch)).toBe(16n);
    const bad = async () => new Response(JSON.stringify({ error: { message: "x" } }));
    expect(await fetchChainHeadBlock("http://rpc", bad as typeof fetch)).toBeNull();
    const boom = async () => {
      throw new Error("down");
    };
    expect(await fetchChainHeadBlock("http://rpc", boom as unknown as typeof fetch)).toBeNull();
  });
});
