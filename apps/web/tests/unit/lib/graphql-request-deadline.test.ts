import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeadlineFetch, GRAPHQL_REQUEST_DEADLINE_MS } from "../../../lib/graphql/request-deadline";

function hangingFetch(): typeof fetch {
  return (() => new Promise<Response>(() => undefined)) as typeof fetch;
}

describe("createDeadlineFetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes a bounded default deadline", () => {
    expect(GRAPHQL_REQUEST_DEADLINE_MS).toBeGreaterThan(0);
    expect(GRAPHQL_REQUEST_DEADLINE_MS).toBeLessThanOrEqual(15_000);
  });

  it("rejects a hanging request once the deadline elapses", async () => {
    vi.useFakeTimers();
    const deadlineFetch = createDeadlineFetch(1_000, hangingFetch());
    const result = deadlineFetch("https://indexer.invalid/graphql").then(
      () => "resolved",
      (error: Error) => error.message
    );
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await result).toMatch(/indexer.*did not respond.*1000/i);
  });

  it("passes responses through untouched and clears the timer", async () => {
    vi.useFakeTimers();
    const response = new Response("ok", { status: 200 });
    const deadlineFetch = createDeadlineFetch(1_000, (async () => response) as typeof fetch);
    await expect(deadlineFetch("https://indexer.invalid/graphql")).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates a fast network failure and clears the timer", async () => {
    vi.useFakeTimers();
    const deadlineFetch = createDeadlineFetch(1_000, (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    await expect(deadlineFetch("https://indexer.invalid/graphql")).rejects.toThrow("fetch failed");
    expect(vi.getTimerCount()).toBe(0);
  });
});
