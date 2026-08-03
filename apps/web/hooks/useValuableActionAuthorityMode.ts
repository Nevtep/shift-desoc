"use client";

import { useEffect, useMemo, useState } from "react";
import { getAbiItem, toFunctionSelector, type Hex } from "viem";

import { CONTRACTS } from "../lib/contracts";
import type { ValuableActionAuthorityMode } from "../lib/community-overview/types";

export type ValuableActionOperation = "create" | "edit" | "activate" | "deactivate";

export type ValuableActionAuthorityEvaluation = {
  operation: ValuableActionOperation;
  mode: ValuableActionAuthorityMode;
  reasonCode?: string;
  reasonMessage?: string;
};

export function evaluateValuableActionAuthorityMode(input: {
  operation: ValuableActionOperation;
  boundaryValid: boolean;
  hasDirectWrite: boolean;
  hasGovernancePath: boolean;
  isConnected: boolean;
}): ValuableActionAuthorityEvaluation {
  if (!input.boundaryValid) {
    return {
      operation: input.operation,
      mode: "blocked",
      reasonCode: "boundary_invalid",
      reasonMessage: "Action cannot cross community boundaries.",
    };
  }

  if (!input.isConnected) {
    return {
      operation: input.operation,
      mode: "blocked",
      reasonCode: "wallet_disconnected",
      reasonMessage: "Connect wallet to continue.",
    };
  }

  if (input.hasDirectWrite) {
    return {
      operation: input.operation,
      mode: "direct_write",
    };
  }

  if (input.hasGovernancePath) {
    return {
      operation: input.operation,
      mode: "governance_required",
      reasonCode: "timelock_required",
      reasonMessage: "Submit this change through governance proposal flow.",
    };
  }

  return {
    operation: input.operation,
    mode: "blocked",
    reasonCode: "no_authority_path",
    reasonMessage: "No authorized execution path is available.",
  };
}

export function useValuableActionAuthorityMode(input: {
  operation: ValuableActionOperation;
  boundaryValid: boolean;
  hasDirectWrite: boolean;
  hasGovernancePath: boolean;
  isConnected: boolean;
}) {
  return useMemo(() => evaluateValuableActionAuthorityMode(input), [
    input.boundaryValid,
    input.hasDirectWrite,
    input.hasGovernancePath,
    input.isConnected,
    input.operation,
  ]);
}

/**
 * Canonical ValuableActionRegistry function guarding each Manager admin operation.
 * The mapping mirrors the AccessManaged (`restricted`) surface of the contract;
 * it does not introduce any app-side shadow authority.
 */
export const VALUABLE_ACTION_OPERATION_FUNCTION: Record<ValuableActionOperation, string> = {
  create: "proposeValuableAction",
  edit: "update",
  activate: "activateFromGovernance",
  deactivate: "deactivate",
};

const ACCESS_MANAGER_CAN_CALL_ABI = [
  {
    type: "function",
    name: "canCall",
    stateMutability: "view",
    inputs: [
      { name: "caller", type: "address" },
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
    ],
    outputs: [
      { name: "immediate", type: "bool" },
      { name: "delay", type: "uint32" },
    ],
  },
] as const;

export function resolveValuableActionOperationSelector(operation: ValuableActionOperation): Hex | null {
  const functionName = VALUABLE_ACTION_OPERATION_FUNCTION[operation];
  if (!functionName) return null;

  try {
    const abiItem = getAbiItem({ abi: CONTRACTS.valuableActionRegistry.abi, name: functionName });
    if (!abiItem || abiItem.type !== "function") return null;
    return toFunctionSelector(abiItem);
  } catch {
    return null;
  }
}

export type ValuableActionDirectAuthorityStatus = "unknown" | "verified" | "unauthorized" | "unavailable";

/**
 * Fail-closed mapping from an AccessManager `canCall` result to a direct-write
 * authority status. Only an immediate grant counts as verified; scheduled
 * (delayed) grants and unreadable results never enable direct execution.
 */
export function mapCanCallToDirectAuthority(result: unknown): ValuableActionDirectAuthorityStatus {
  if (!Array.isArray(result)) return "unavailable";
  const [immediate] = result;
  if (immediate === true) return "verified";
  return "unauthorized";
}

type MinimalPublicClient = {
  // Method syntax keeps this assignable from viem's generic PublicClient.
  readContract(args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
};

export type ValuableActionDirectWriteAuthority = {
  status: ValuableActionDirectAuthorityStatus;
  hasDirectWrite: boolean;
  isChecking: boolean;
};

/**
 * Resolves whether the connected wallet can really execute the given
 * Valuable Action operation directly, by asking the community AccessManager
 * (`canCall`) about the canonical registry selector. Fails closed on any
 * missing wiring or read error so governance prefill stays the fallback path.
 */
export function useValuableActionDirectWriteAuthority(input: {
  operation: ValuableActionOperation;
  walletAddress?: string;
  registryAddress?: string;
  accessManagerAddress?: string;
  publicClient?: MinimalPublicClient | null;
  enabled?: boolean;
}): ValuableActionDirectWriteAuthority {
  const { operation, walletAddress, registryAddress, accessManagerAddress, publicClient, enabled = true } = input;
  const [status, setStatus] = useState<ValuableActionDirectAuthorityStatus>("unknown");
  const [isChecking, setIsChecking] = useState(false);

  const selector = useMemo(() => resolveValuableActionOperationSelector(operation), [operation]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setStatus("unknown");
      setIsChecking(false);
      return;
    }

    if (!walletAddress || !registryAddress || !accessManagerAddress || !publicClient || !selector) {
      setStatus("unavailable");
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setStatus("unknown");

    publicClient
      .readContract({
        address: accessManagerAddress as `0x${string}`,
        abi: ACCESS_MANAGER_CAN_CALL_ABI,
        functionName: "canCall",
        args: [walletAddress, registryAddress, selector],
      })
      .then((result) => {
        if (cancelled) return;
        setStatus(mapCanCallToDirectAuthority(result));
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unavailable");
      })
      .finally(() => {
        if (cancelled) return;
        setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, walletAddress, registryAddress, accessManagerAddress, publicClient, selector]);

  return {
    status,
    hasDirectWrite: status === "verified",
    isChecking,
  };
}
