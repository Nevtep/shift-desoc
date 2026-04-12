"use client";

import { useMemo } from "react";
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
