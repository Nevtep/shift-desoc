import { resolveTargetAddress, type CommunityModuleAddressMap } from "../actions/target-resolution";

import type {
  DirectProposalGuardResult,
  DirectProposalIntent,
  DirectProposalPreflightInput
} from "./direct-proposal-types";

export function validateDirectProposalShape(intent: DirectProposalIntent): DirectProposalGuardResult {
  if (!Number.isFinite(intent.communityId) || intent.communityId <= 0) {
    return { ok: false, errorType: "invalid_community", message: "Invalid community context." };
  }

  if (!intent.governorAddress) {
    return { ok: false, errorType: "governor_missing", message: "Governor is not configured for this community." };
  }

  if (!intent.description.trim()) {
    return { ok: false, errorType: "allowlist_violation", message: "Description is required." };
  }

  if (
    intent.targets.length === 0 ||
    intent.targets.length !== intent.values.length ||
    intent.targets.length !== intent.calldatas.length
  ) {
    return { ok: false, errorType: "allowlist_violation", message: "Action bundle arrays must match exactly." };
  }

  if (intent.mode === "multi_choice" && (!intent.numOptions || intent.numOptions < 2)) {
    return { ok: false, errorType: "allowlist_violation", message: "Multi-choice proposals require at least 2 options." };
  }

  return { ok: true };
}

export function validateDirectProposalPreflight(input: DirectProposalPreflightInput): DirectProposalGuardResult {
  const shape = validateDirectProposalShape(input.intent);
  if (!shape.ok) return shape;

  if (input.routeCommunityId !== input.intent.communityId) {
    return {
      ok: false,
      errorType: "context_mismatch",
      message: "Route community does not match proposal intent community."
    };
  }

  if (!input.resolvedGovernorAddress) {
    return {
      ok: false,
      errorType: "governor_missing",
      message: "Governor module is missing for this community."
    };
  }

  if (input.resolvedGovernorAddress.toLowerCase() !== input.intent.governorAddress.toLowerCase()) {
    return {
      ok: false,
      errorType: "context_mismatch",
      message: "Governor context mismatch for selected community."
    };
  }

  if (input.connectedChainId !== input.expectedChainId) {
    return {
      ok: false,
      errorType: "chain_mismatch",
      message: "Connected wallet network does not match the configured chain."
    };
  }

  return { ok: true };
}

export function validateComposerAllowlist(params: {
  intent: DirectProposalIntent;
  chainId: number;
  moduleAddressMap: CommunityModuleAddressMap;
  allowlistedSignaturesByTarget: Record<string, Set<string>>;
}): DirectProposalGuardResult {
  const { intent, chainId, moduleAddressMap, allowlistedSignaturesByTarget } = params;

  for (const action of intent.actions) {
    if (!action.targetId) {
      return {
        ok: false,
        errorType: "allowlist_violation",
        message: "Action target metadata missing. Rebuild actions using guided or expert composer."
      };
    }

    const allowlisted = allowlistedSignaturesByTarget[action.targetId]?.has(action.functionSignature);
    if (!allowlisted) {
      return {
        ok: false,
        errorType: "allowlist_violation",
        message: `Function ${action.functionSignature} is not allowlisted for ${action.targetId}.`
      };
    }

    const resolved = resolveTargetAddress(action.targetId, chainId, moduleAddressMap);
    if (!resolved || resolved.toLowerCase() !== action.target.toLowerCase()) {
      return {
        ok: false,
        errorType: "context_mismatch",
        message: `Resolved target mismatch for ${action.targetId}.`
      };
    }
  }

  return { ok: true };
}
