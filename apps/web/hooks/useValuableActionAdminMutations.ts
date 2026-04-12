"use client";

import { useMutation } from "@tanstack/react-query";

import type { ValuableActionAuthorityMode } from "../lib/community-overview/types";

type ValuableActionCategory = "ENGAGEMENT_ONE_SHOT" | "POSITION_ASSIGNMENT" | "INVESTMENT" | "CREDENTIAL";
type VerifierPolicy = "NONE" | "FIXED" | "ROLE_BASED" | "JURY" | "MULTISIG";

const CATEGORY_TO_SOLIDITY: Record<ValuableActionCategory, number> = {
  ENGAGEMENT_ONE_SHOT: 0,
  POSITION_ASSIGNMENT: 1,
  INVESTMENT: 2,
  CREDENTIAL: 3,
};

const VERIFIER_POLICY_TO_SOLIDITY: Record<VerifierPolicy, number> = {
  NONE: 0,
  FIXED: 1,
  ROLE_BASED: 2,
  JURY: 3,
  MULTISIG: 4,
};

function clampUnsigned(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return Math.trunc(value);
}

function toBytes32Hex(raw: string): `0x${string}` {
  const value = raw.trim();
  if (!value) return "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as `0x${string}`;
  return "0x0000000000000000000000000000000000000000000000000000000000000000";
}

function normalizeAddress(raw?: string): `0x${string}` {
  const value = (raw ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return value as `0x${string}`;
  return "0x0000000000000000000000000000000000000000";
}

export type ValuableActionMutationPayload = {
  communityId: number;
  actionId?: number;
  title?: string;
  metadataCid?: string;
  ruleSummary?: string;
  active?: boolean;
  category?: ValuableActionCategory;
  verifierPolicy?: VerifierPolicy;
  membershipTokenReward?: number;
  communityTokenReward?: number;
  jurorsMin?: number;
  panelSize?: number;
  verifyWindow?: number;
  cooldownPeriod?: number;
  revocable?: boolean;
  proposalThreshold?: string;
  investorSBTReward?: number;
  roleTypeId?: string;
  positionPoints?: number;
  metadataSchemaId?: string;
  verifierRewardWeight?: number;
  slashVerifierBps?: number;
  maxConcurrent?: number;
  evidenceTypes?: number;
  proposer?: string;
  titleTemplate?: string;
  activationDelay?: number;
  deprecationWarning?: number;
  automationRules?: string[];
};

export type ValuableActionContractPayload = {
  membershipTokenReward: number;
  communityTokenReward: number;
  investorSBTReward: number;
  category: number;
  roleTypeId: `0x${string}`;
  positionPoints: number;
  verifierPolicy: number;
  metadataSchemaId: `0x${string}`;
  jurorsMin: number;
  panelSize: number;
  verifyWindow: number;
  verifierRewardWeight: number;
  slashVerifierBps: number;
  cooldownPeriod: number;
  maxConcurrent: number;
  revocable: boolean;
  evidenceTypes: number;
  proposalThreshold: bigint;
  proposer: `0x${string}`;
  evidenceSpecCID: string;
  titleTemplate: string;
  automationRules: `0x${string}`[];
  activationDelay: number;
  deprecationWarning: number;
};

export function validateValuableActionContractPayload(payload: ValuableActionContractPayload): void {
  if (payload.membershipTokenReward === 0) {
    throw new Error("MembershipToken reward cannot be zero.");
  }
  if (payload.jurorsMin === 0) {
    throw new Error("Minimum jurors cannot be zero.");
  }
  if (payload.panelSize === 0) {
    throw new Error("Panel size cannot be zero.");
  }
  if (payload.jurorsMin > payload.panelSize) {
    throw new Error("Minimum jurors cannot exceed panel size.");
  }
  if (payload.verifyWindow === 0) {
    throw new Error("Verify window cannot be zero.");
  }
  if (payload.cooldownPeriod === 0) {
    throw new Error("Cooldown period cannot be zero.");
  }
  if (payload.evidenceSpecCID.trim().length === 0) {
    throw new Error("Evidence spec CID cannot be empty.");
  }
}

export function buildValuableActionContractPayload(payload: ValuableActionMutationPayload): ValuableActionContractPayload {
  const category = payload.category ?? "ENGAGEMENT_ONE_SHOT";
  const verifierPolicy = payload.verifierPolicy ?? "JURY";
  const metadataCid = (payload.metadataCid ?? "").trim();

  return {
    membershipTokenReward: clampUnsigned(payload.membershipTokenReward ?? 0, 2 ** 32 - 1),
    communityTokenReward: clampUnsigned(payload.communityTokenReward ?? 0, 2 ** 32 - 1),
    investorSBTReward: clampUnsigned(payload.investorSBTReward ?? 0, 2 ** 32 - 1),
    category: CATEGORY_TO_SOLIDITY[category],
    roleTypeId: toBytes32Hex(payload.roleTypeId ?? ""),
    positionPoints: clampUnsigned(payload.positionPoints ?? 0, 2 ** 32 - 1),
    verifierPolicy: VERIFIER_POLICY_TO_SOLIDITY[verifierPolicy],
    metadataSchemaId: toBytes32Hex(payload.metadataSchemaId ?? ""),
    jurorsMin: clampUnsigned(payload.jurorsMin ?? 0, 2 ** 32 - 1),
    panelSize: clampUnsigned(payload.panelSize ?? 0, 2 ** 32 - 1),
    verifyWindow: clampUnsigned(payload.verifyWindow ?? 0, 2 ** 32 - 1),
    verifierRewardWeight: clampUnsigned(payload.verifierRewardWeight ?? 0, 2 ** 32 - 1),
    slashVerifierBps: clampUnsigned(payload.slashVerifierBps ?? 0, 10_000),
    cooldownPeriod: clampUnsigned(payload.cooldownPeriod ?? 0, 2 ** 32 - 1),
    maxConcurrent: clampUnsigned(payload.maxConcurrent ?? 0, 2 ** 32 - 1),
    revocable: payload.revocable ?? true,
    evidenceTypes: clampUnsigned(payload.evidenceTypes ?? 0, 2 ** 32 - 1),
    proposalThreshold: BigInt(payload.proposalThreshold && /^\d+$/.test(payload.proposalThreshold) ? payload.proposalThreshold : "0"),
    proposer: normalizeAddress(payload.proposer),
    evidenceSpecCID: metadataCid,
    titleTemplate: (payload.titleTemplate ?? payload.title ?? "").trim(),
    automationRules: (payload.automationRules ?? []).map((entry) => toBytes32Hex(entry)),
    activationDelay: clampUnsigned(payload.activationDelay ?? 0, 2 ** 64 - 1),
    deprecationWarning: clampUnsigned(payload.deprecationWarning ?? 0, 2 ** 64 - 1),
  };
}

type MutationResult = {
  mode: ValuableActionAuthorityMode;
  status: "pending" | "submitted" | "blocked";
  message: string;
  route: "direct_write" | "governance" | "none";
  payload: ValuableActionMutationPayload;
  contractPayload?: ValuableActionContractPayload;
};

export async function executeMutationByMode(
  mode: ValuableActionAuthorityMode,
  payload: ValuableActionMutationPayload
): Promise<MutationResult> {
  const isCreateOrEdit = typeof payload.title === "string" || typeof payload.metadataCid === "string";
  const contractPayload = isCreateOrEdit ? buildValuableActionContractPayload(payload) : undefined;

  if (contractPayload) {
    validateValuableActionContractPayload(contractPayload);
  }

  if (mode === "blocked") {
    return {
      mode,
      status: "blocked",
      message: "Operation blocked by authority policy.",
      route: "none",
      payload,
      contractPayload,
    };
  }

  if (mode === "governance_required") {
    return {
      mode,
      status: "submitted",
      message: "Routed to governance proposal flow.",
      route: "governance",
      payload,
      contractPayload,
    };
  }

  return {
    mode,
    status: "submitted",
    message: "Submitted via direct write path.",
    route: "direct_write",
    payload,
    contractPayload,
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
