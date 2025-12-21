import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";

import { useIpfsDocument } from "./useIpfsDocument";
import { fixtures } from "../tests/unit/mocks/fixtures";
import { server } from "../tests/unit/server";
import { TestWrapper } from "../tests/unit/utils";

describe("useIpfsDocument", () => {
  it("returns parsed content for known CIDs", async () => {
    const { result } = renderHook(() => useIpfsDocument(fixtures.request.cid), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.data?.cid).toBe(fixtures.request.cid));
    expect(result.current.data?.html?.body).toContain("Request body");
  });

  it("does not run when cid is missing", () => {
    const { result } = renderHook(() => useIpfsDocument(undefined), { wrapper: TestWrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("surfaces fetch errors", async () => {
    server.use(http.get("/api/ipfs/error", () => HttpResponse.json({ message: "error" }, { status: 500 })));

    const { result } = renderHook(() => useIpfsDocument("error"), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain("500");
  });
});
