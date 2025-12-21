import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";

import { useApiQuery } from "./useApiQuery";
import { apiBaseUrl } from "../tests/unit/mocks/handlers";
import { server } from "../tests/unit/server";
import { TestWrapper } from "../tests/unit/utils";

describe("useApiQuery", () => {
  it("fetches data using the API base URL", async () => {
    server.use(http.get(`${apiBaseUrl}/status`, () => HttpResponse.json({ ok: true })));

    const { result } = renderHook(() => useApiQuery<{ ok: boolean }>(["status"], "/status"), {
      wrapper: TestWrapper
    });

    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.isSuccess).toBe(true);
  });

  it("surfaces HTTP failures", async () => {
    server.use(http.get(`${apiBaseUrl}/status`, () => HttpResponse.json({ message: "nope" }, { status: 500 })));

    const { result } = renderHook(() => useApiQuery<{ ok: boolean }>(["status"], "/status"), {
      wrapper: TestWrapper
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain("500");
  });
});
