import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  mapCanCallToDirectAuthority,
  resolveValuableActionOperationSelector,
  useValuableActionDirectWriteAuthority,
  VALUABLE_ACTION_OPERATION_FUNCTION,
  type ValuableActionOperation,
} from "../../../hooks/useValuableActionAuthorityMode";

const OPERATIONS: ValuableActionOperation[] = ["create", "edit", "activate", "deactivate"];

const WALLET = "0x1111111111111111111111111111111111111111";
const REGISTRY = "0x2222222222222222222222222222222222222222";
const ACCESS_MANAGER = "0x3333333333333333333333333333333333333333";

describe("valuable action direct-write authority resolution", () => {
  it("maps every operation to a distinct canonical registry selector", () => {
    const selectors = OPERATIONS.map((operation) => resolveValuableActionOperationSelector(operation));

    for (const selector of selectors) {
      expect(selector).toMatch(/^0x[0-9a-f]{8}$/);
    }
    expect(new Set(selectors).size).toBe(OPERATIONS.length);
    expect(VALUABLE_ACTION_OPERATION_FUNCTION.edit).toBe("update");
    expect(VALUABLE_ACTION_OPERATION_FUNCTION.create).toBe("proposeValuableAction");
    expect(VALUABLE_ACTION_OPERATION_FUNCTION.activate).toBe("activateFromGovernance");
    expect(VALUABLE_ACTION_OPERATION_FUNCTION.deactivate).toBe("deactivate");
  });

  it("treats only an immediate canCall grant as verified direct authority", () => {
    expect(mapCanCallToDirectAuthority([true, 0])).toBe("verified");
    expect(mapCanCallToDirectAuthority([false, 0])).toBe("unauthorized");
    expect(mapCanCallToDirectAuthority([false, 3600])).toBe("delayed");
    expect(mapCanCallToDirectAuthority([false, 3600n])).toBe("delayed");
    expect(mapCanCallToDirectAuthority(undefined)).toBe("unavailable");
    expect(mapCanCallToDirectAuthority("bogus")).toBe("unavailable");
  });

  it("verifies direct write through AccessManager canCall for the connected wallet", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const publicClient = {
      readContract: async (args: Record<string, unknown>) => {
        calls.push(args);
        return [true, 0];
      },
    };

    const { result } = renderHook(() =>
      useValuableActionDirectWriteAuthority({
        operation: "edit",
        walletAddress: WALLET,
        registryAddress: REGISTRY,
        accessManagerAddress: ACCESS_MANAGER,
        publicClient,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.status).toBe("verified"));
    expect(result.current.hasDirectWrite).toBe(true);
    expect(calls[0]?.address).toBe(ACCESS_MANAGER);
    expect(calls[0]?.functionName).toBe("canCall");
    expect((calls[0]?.args as unknown[])[0]).toBe(WALLET);
    expect((calls[0]?.args as unknown[])[1]).toBe(REGISTRY);
    expect((calls[0]?.args as unknown[])[2]).toBe(resolveValuableActionOperationSelector("edit"));
  });

  it("fails closed to no direct write when the wallet is not authorized", async () => {
    const publicClient = {
      readContract: async () => [false, 0],
    };

    const { result } = renderHook(() =>
      useValuableActionDirectWriteAuthority({
        operation: "deactivate",
        walletAddress: WALLET,
        registryAddress: REGISTRY,
        accessManagerAddress: ACCESS_MANAGER,
        publicClient,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.status).toBe("unauthorized"));
    expect(result.current.hasDirectWrite).toBe(false);
  });

  it("fails closed when the authority check cannot run or errors", async () => {
    const failing = {
      readContract: async () => {
        throw new Error("rpc unavailable");
      },
    };

    const { result: erroring } = renderHook(() =>
      useValuableActionDirectWriteAuthority({
        operation: "create",
        walletAddress: WALLET,
        registryAddress: REGISTRY,
        accessManagerAddress: ACCESS_MANAGER,
        publicClient: failing,
        enabled: true,
      })
    );

    await waitFor(() => expect(erroring.current.status).toBe("unavailable"));
    expect(erroring.current.hasDirectWrite).toBe(false);

    const { result: missing } = renderHook(() =>
      useValuableActionDirectWriteAuthority({
        operation: "create",
        walletAddress: WALLET,
        registryAddress: REGISTRY,
        accessManagerAddress: undefined,
        publicClient: failing,
        enabled: true,
      })
    );

    await waitFor(() => expect(missing.current.status).toBe("unavailable"));
    expect(missing.current.hasDirectWrite).toBe(false);
  });
});
