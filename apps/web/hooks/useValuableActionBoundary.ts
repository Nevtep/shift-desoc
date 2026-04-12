"use client";

import { useMemo } from "react";

export type ValuableActionBoundaryCheck = {
  communityId: number;
  actionId: number;
  boundaryValid: boolean;
  reasonCode: "ok" | "invalid_input" | "community_mismatch";
  reasonMessage: string;
};

export function evaluateValuableActionBoundary(input: {
  activeCommunityId: number;
  payloadCommunityId: number;
  actionId: number;
  resolvedActionCommunityId?: number | null;
}): ValuableActionBoundaryCheck {
  const activeCommunityId = Number(input.activeCommunityId);
  const payloadCommunityId = Number(input.payloadCommunityId);
  const actionId = Number(input.actionId);

  if (!Number.isFinite(activeCommunityId) || activeCommunityId <= 0) {
    return {
      communityId: payloadCommunityId,
      actionId,
      boundaryValid: false,
      reasonCode: "invalid_input",
      reasonMessage: "Active community context is invalid.",
    };
  }

  if (!Number.isFinite(payloadCommunityId) || payloadCommunityId <= 0 || !Number.isFinite(actionId) || actionId < 0) {
    return {
      communityId: payloadCommunityId,
      actionId,
      boundaryValid: false,
      reasonCode: "invalid_input",
      reasonMessage: "Action payload contains invalid identifiers.",
    };
  }

  if (activeCommunityId !== payloadCommunityId) {
    return {
      communityId: payloadCommunityId,
      actionId,
      boundaryValid: false,
      reasonCode: "community_mismatch",
      reasonMessage: "Route community does not match payload community.",
    };
  }

  if (
    input.resolvedActionCommunityId !== undefined &&
    input.resolvedActionCommunityId !== null &&
    Number(input.resolvedActionCommunityId) !== activeCommunityId
  ) {
    return {
      communityId: payloadCommunityId,
      actionId,
      boundaryValid: false,
      reasonCode: "community_mismatch",
      reasonMessage: "Action belongs to a different community.",
    };
  }

  return {
    communityId: payloadCommunityId,
    actionId,
    boundaryValid: true,
    reasonCode: "ok",
    reasonMessage: "Boundary check passed.",
  };
}

export function useValuableActionBoundary(input: {
  activeCommunityId: number;
  payloadCommunityId: number;
  actionId: number;
  resolvedActionCommunityId?: number | null;
}) {
  return useMemo(() => evaluateValuableActionBoundary(input), [
    input.actionId,
    input.activeCommunityId,
    input.payloadCommunityId,
    input.resolvedActionCommunityId,
  ]);
}
