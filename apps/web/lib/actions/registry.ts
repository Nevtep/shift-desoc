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

export function listActionTargets(): ActionTargetDefinition[] {
  return Object.values(TARGET_DEFINITIONS);
}

export function getTargetDefinition(targetId: ActionTargetId): ActionTargetDefinition {
  return TARGET_DEFINITIONS[targetId];
}

export function getTargetFunctions(targetId: ActionTargetId): TargetFunctionDefinition[] {
  return TARGET_FUNCTIONS[targetId];
}
