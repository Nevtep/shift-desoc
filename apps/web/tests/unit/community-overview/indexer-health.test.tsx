import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { INDEXER_LAG_THRESHOLD_SECONDS } from "../../../lib/community-overview/constants";
import { useIndexerHealth } from "../../../hooks/useIndexerHealth";
import { server } from "../server";
import { TestWrapper } from "../utils";

describe("useIndexerHealth", () => {
  it("returns synced when indexer is healthy and previews are fresh", async () => {
    const freshTimestamp = new Date(Date.now() - 30_000).toISOString();

    const { result } = renderHook(() => useIndexerHealth(freshTimestamp), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.state).toBe("synced");
  });

  it("returns lagging when latest preview exceeds lag threshold", async () => {
    const olderThanThreshold = new Date(
      Date.now() - (INDEXER_LAG_THRESHOLD_SECONDS + 1) * 1000
    ).toISOString();

    const { result } = renderHook(() => useIndexerHealth(olderThanThreshold), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBe("lagging");
  });

  it("returns unknown when no preview timestamp is available", async () => {
    const { result } = renderHook(() => useIndexerHealth(null), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBe("unknown");
  });

  it("returns error when health endpoint fails", async () => {
    server.use(
      http.get("http://localhost:4000/api/health", () => {
        return HttpResponse.json({ ok: false }, { status: 503 });
      })
    );

    const { result } = renderHook(() => useIndexerHealth("2026-01-01T00:00:00.000Z"), {
      wrapper: TestWrapper
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.state).toBe("error");
  });
});
