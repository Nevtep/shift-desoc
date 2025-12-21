import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, graphql } from "msw";

import { useGraphQLQuery } from "./useGraphQLQuery";
import { server } from "../tests/unit/server";
import { TestWrapper } from "../tests/unit/utils";

const TEST_DOCUMENT = /* GraphQL */ `
  query TestQuery {
    ping
  }
`;

describe("useGraphQLQuery", () => {
  it("returns data from GraphQL client", async () => {
    server.use(graphql.query("TestQuery", () => HttpResponse.json({ data: { ping: "pong" } })));

    const { result } = renderHook(() => useGraphQLQuery<{ ping: string }>(["ping"], TEST_DOCUMENT), {
      wrapper: TestWrapper
    });

    await waitFor(() => expect(result.current.data).toEqual({ ping: "pong" }));
    expect(result.current.isSuccess).toBe(true);
  });

  it("propagates GraphQL errors", async () => {
    server.use(graphql.query("TestQuery", () => HttpResponse.json({ errors: [{ message: "boom" }] }, { status: 500 })));

    const { result } = renderHook(() => useGraphQLQuery<{ ping: string }>(["ping"], TEST_DOCUMENT), {
      wrapper: TestWrapper
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain("boom");
  });
});
