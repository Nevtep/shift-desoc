import type { Abi, AbiFunction } from "viem";

import { CONTRACTS } from "../contracts";

export type ActionTargetId = keyof typeof CONTRACTS;

export type ActionTargetDefinition = {
  id: ActionTargetId;
  label: string;
  description?: string;
};

export type TargetFunctionDefinition = {
  functionName: string;
  abiFragment: AbiFunction;
};

export type GuidedTemplateId = "valuableActionProposal" | "requestStatus";

export type GuidedTemplateDefinition = {
  id: GuidedTemplateId;
  label: string;
  description: string;
  targetId: ActionTargetId;
  functionName: string;
};

export type RewardTierPreset = {
  id: "micro" | "standard" | "high";
  label: string;
  membershipTokenReward: number;
  communityTokenReward: number;
};

export type VerificationStrictnessPreset = {
  id: "light" | "balanced" | "strict";
  label: string;
  jurorsMin: number;
  panelSize: number;
  verifyWindowSeconds: number;
  verifierRewardWeight: number;
  slashVerifierBps: number;
};

export type EvidencePreset = {
  id: "basic" | "traceable" | "auditable";
  label: string;
  evidenceTypes: number;
  evidenceSpecCID: string;
};

const TARGET_DEFINITIONS: Record<ActionTargetId, ActionTargetDefinition> = {
  communityRegistry: {
    id: "communityRegistry",
    label: "CommunityRegistry",
    description: "Community metadata, module wiring, and role management"
  },
  draftsManager: {
    id: "draftsManager",
    label: "DraftsManager",
    description: "Draft lifecycle and governance escalation actions"
  },
  engagements: {
    id: "engagements",
    label: "Engagements",
    description: "Work verification flow and engagement lifecycle actions"
  },
  governor: {
    id: "governor",
    label: "ShiftGovernor",
    description: "Governance proposal and voting actions"
  },
  requestHub: {
    id: "requestHub",
    label: "RequestHub",
    description: "Community discussion and moderation actions"
  },
  valuableActionRegistry: {
    id: "valuableActionRegistry",
    label: "ValuableActionRegistry",
    description: "Valuable action definitions and activation controls"
  }
};

function getMutableFunctions(abi: Abi): TargetFunctionDefinition[] {
  const byName = new Map<string, TargetFunctionDefinition>();

  for (const item of abi) {
    if (item.type !== "function") continue;

    const fn = item as AbiFunction;
    if (fn.stateMutability !== "nonpayable" && fn.stateMutability !== "payable") continue;

    // Keep one entry per function name to avoid ambiguous overload selection in the UI.
    if (!byName.has(fn.name)) {
      byName.set(fn.name, {
        functionName: fn.name,
        abiFragment: fn
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.functionName.localeCompare(b.functionName));
}

const TARGET_FUNCTIONS: Record<ActionTargetId, TargetFunctionDefinition[]> = {
  communityRegistry: getMutableFunctions(CONTRACTS.communityRegistry.abi),
  draftsManager: getMutableFunctions(CONTRACTS.draftsManager.abi),
  engagements: getMutableFunctions(CONTRACTS.engagements.abi),
  governor: getMutableFunctions(CONTRACTS.governor.abi),
  requestHub: getMutableFunctions(CONTRACTS.requestHub.abi),
  valuableActionRegistry: getMutableFunctions(CONTRACTS.valuableActionRegistry.abi)
};

const GUIDED_TEMPLATES: Record<GuidedTemplateId, GuidedTemplateDefinition> = {
  valuableActionProposal: {
    id: "valuableActionProposal",
    label: "Valuable action proposal",
    description: "Propose a new work type with guided defaults and verifier policy safeguards.",
    targetId: "valuableActionRegistry",
    functionName: "proposeValuableAction"
  },
  requestStatus: {
    id: "requestStatus",
    label: "Request status change",
    description: "Freeze or archive an existing request through governance.",
    targetId: "requestHub",
    functionName: "setRequestStatus"
  }
};

export const GUIDED_REWARD_TIERS: readonly RewardTierPreset[] = [
  {
    id: "micro",
    label: "Micro (quick contribution)",
    membershipTokenReward: 15,
    communityTokenReward: 5
  },
  {
    id: "standard",
    label: "Standard (core contribution)",
    membershipTokenReward: 50,
    communityTokenReward: 20
  },
  {
    id: "high",
    label: "High impact",
    membershipTokenReward: 120,
    communityTokenReward: 55
  }
];

export const GUIDED_VERIFICATION_STRICTNESS: readonly VerificationStrictnessPreset[] = [
  {
    id: "light",
    label: "Light review (2 of 3 jurors)",
    jurorsMin: 2,
    panelSize: 3,
    verifyWindowSeconds: 48 * 60 * 60,
    verifierRewardWeight: 5,
    slashVerifierBps: 100
  },
  {
    id: "balanced",
    label: "Balanced review (3 of 5 jurors)",
    jurorsMin: 3,
    panelSize: 5,
    verifyWindowSeconds: 72 * 60 * 60,
    verifierRewardWeight: 10,
    slashVerifierBps: 250
  },
  {
    id: "strict",
    label: "Strict review (5 of 7 jurors)",
    jurorsMin: 5,
    panelSize: 7,
    verifyWindowSeconds: 96 * 60 * 60,
    verifierRewardWeight: 15,
    slashVerifierBps: 500
  }
];

export const GUIDED_EVIDENCE_PRESETS: readonly EvidencePreset[] = [
  {
    id: "basic",
    label: "Basic evidence",
    evidenceTypes: 1,
    evidenceSpecCID: "ipfs://shift/evidence/basic"
  },
  {
    id: "traceable",
    label: "Traceable evidence",
    evidenceTypes: 3,
    evidenceSpecCID: "ipfs://shift/evidence/traceable"
  },
  {
    id: "auditable",
    label: "Auditable evidence",
    evidenceTypes: 7,
    evidenceSpecCID: "ipfs://shift/evidence/auditable"
  }
];

export const GUIDED_VALUE_ACTION_LOCKED_DEFAULTS = {
  category: 0,
  roleTypeSeed: "role.default.worker",
  metadataSchemaSeed: "schema.default.proof.v1",
  verifierPolicy: 3,
  positionPoints: 0,
  investorSBTReward: 0,
  cooldownPeriodSeconds: 24 * 60 * 60,
  maxConcurrent: 1,
  proposalThreshold: 0,
  activationDelaySeconds: 60 * 60,
  deprecationWarningSeconds: 14 * 24 * 60 * 60,
  automationRuleSeeds: ["automation.none"]
} as const;

export function listActionTargets(): ActionTargetDefinition[] {
  return Object.values(TARGET_DEFINITIONS);
}

export function getTargetDefinition(targetId: ActionTargetId): ActionTargetDefinition {
  return TARGET_DEFINITIONS[targetId];
}

export function getTargetFunctions(targetId: ActionTargetId): TargetFunctionDefinition[] {
  return TARGET_FUNCTIONS[targetId];
}

export function listGuidedTemplates(): GuidedTemplateDefinition[] {
  return Object.values(GUIDED_TEMPLATES);
}

export function getGuidedTemplate(id: GuidedTemplateId): GuidedTemplateDefinition {
  return GUIDED_TEMPLATES[id];
}
