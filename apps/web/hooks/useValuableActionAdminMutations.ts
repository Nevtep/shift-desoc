"use client";

import { useMutation } from "@tanstack/react-query";

import type { ValuableActionAuthorityMode } from "../lib/community-overview/types";

export type ValuableActionMutationPayload = {
  communityId: number;
  actionId?: number;
  title?: string;
  metadataCid?: string;
  ruleSummary?: string;
  active?: boolean;
};

type MutationResult = {
  mode: ValuableActionAuthorityMode;
  status: "pending" | "submitted" | "blocked";
  message: string;
  route: "direct_write" | "governance" | "none";
  payload: ValuableActionMutationPayload;
};

export async function executeMutationByMode(
  mode: ValuableActionAuthorityMode,
  payload: ValuableActionMutationPayload
): Promise<MutationResult> {
  if (mode === "blocked") {
    return {
      mode,
      status: "blocked",
      message: "Operation blocked by authority policy.",
      route: "none",
      payload,
    };
  }

  if (mode === "governance_required") {
    return {
      mode,
      status: "submitted",
      message: "Routed to governance proposal flow.",
      route: "governance",
      payload,
    };
  }

  return {
    mode,
    status: "submitted",
    message: "Submitted via direct write path.",
    route: "direct_write",
    payload,
  };
}

export function useValuableActionAdminMutations() {
  const create = useMutation({
    mutationFn: ({ mode, payload }: { mode: ValuableActionAuthorityMode; payload: ValuableActionMutationPayload }) =>
      executeMutationByMode(mode, payload),
  });

  const edit = useMutation({
    mutationFn: ({ mode, payload }: { mode: ValuableActionAuthorityMode; payload: ValuableActionMutationPayload }) =>
      executeMutationByMode(mode, payload),
  });

  const toggleActivation = useMutation({
    mutationFn: ({ mode, payload }: { mode: ValuableActionAuthorityMode; payload: ValuableActionMutationPayload }) =>
      executeMutationByMode(mode, payload),
  });

  return {
    create,
    edit,
    toggleActivation,
  };
}
