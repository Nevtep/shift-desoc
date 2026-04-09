import { keccak256, toBytes } from "viem";

export type RoleName = "ADMIN_ROLE" | string;

export type PermissionMatrixEntry = {
  contractName: string;
  targetKey: string;
  targetVariable: string;
  signature: string;
  selector: string;
  roleName: RoleName;
  roleValue: string;
  sourceFile: string;
  sourceLine: number;
};

export type PermissionMatrixFailureReason = "signature_not_found" | "selector_mismatch" | "artifact_missing";

export type PermissionMatrixFailure = {
  contractName: string;
  targetKey: string;
  signature: string;
  selector: string;
  reason: PermissionMatrixFailureReason;
};

export type PermissionMatrixContractTarget = {
  targetVariable: string;
  targetKey: string;
  contractName: string;
  abiFileName: string;
};

export type ParsedSelectorRoleAssignment = {
  targetVariable: string;
  roleExpression: string;
  signatures: string[];
  sourceLine: number;
};

export type PermissionMatrixBuildResult = {
  entries: PermissionMatrixEntry[];
  collisions: PermissionMatrixFailure[];
  unknownTargets: string[];
};

export type AbiFunctionLookup = {
  signatures: Set<string>;
  selectorBySignature: Map<string, string>;
};

const ASSIGNMENT_START = "const selectorRoleAssignments = [";
const ASSIGNMENT_END = "] as const;";

const TARGETS: Record<string, PermissionMatrixContractTarget> = {
  valuableActionRegistry: {
    targetVariable: "valuableActionRegistry",
    targetKey: "valuableActionRegistry",
    contractName: "ValuableActionRegistry",
    abiFileName: "ValuableActionRegistry.json"
  },
  engagements: {
    targetVariable: "engagements",
    targetKey: "engagements",
    contractName: "Engagements",
    abiFileName: "Engagements.json"
  },
  verifierElection: {
    targetVariable: "verifierElection",
    targetKey: "verifierElection",
    contractName: "VerifierElection",
    abiFileName: "VerifierElection.json"
  },
  verifierManager: {
    targetVariable: "verifierManager",
    targetKey: "verifierManager",
    contractName: "VerifierManager",
    abiFileName: "VerifierManager.json"
  },
  verifierPowerToken: {
    targetVariable: "verifierPowerToken",
    targetKey: "verifierPowerToken",
    contractName: "VerifierPowerToken1155",
    abiFileName: "VerifierPowerToken1155.json"
  },
  revenueRouter: {
    targetVariable: "revenueRouter",
    targetKey: "revenueRouter",
    contractName: "RevenueRouter",
    abiFileName: "RevenueRouter.json"
  },
  positionManager: {
    targetVariable: "positionManager",
    targetKey: "positionManager",
    contractName: "PositionManager",
    abiFileName: "PositionManager.json"
  },
  cohortRegistry: {
    targetVariable: "cohortRegistry",
    targetKey: "cohortRegistry",
    contractName: "CohortRegistry",
    abiFileName: "CohortRegistry.json"
  },
  investmentCohortManager: {
    targetVariable: "investmentCohortManager",
    targetKey: "investmentCohortManager",
    contractName: "InvestmentCohortManager",
    abiFileName: "InvestmentCohortManager.json"
  },
  credentialManager: {
    targetVariable: "credentialManager",
    targetKey: "credentialManager",
    contractName: "CredentialManager",
    abiFileName: "CredentialManager.json"
  },
  treasuryAdapter: {
    targetVariable: "treasuryAdapter",
    targetKey: "treasuryAdapter",
    contractName: "TreasuryAdapter",
    abiFileName: "TreasuryAdapter.json"
  },
  marketplace: {
    targetVariable: "marketplace",
    targetKey: "marketplace",
    contractName: "Marketplace",
    abiFileName: "Marketplace.json"
  },
  membershipToken: {
    targetVariable: "membershipToken",
    targetKey: "membershipToken",
    contractName: "MembershipTokenERC20Votes",
    abiFileName: "MembershipTokenERC20Votes.json"
  },
  valuableActionSBT: {
    targetVariable: "valuableActionSBT",
    targetKey: "valuableActionSBT",
    contractName: "ValuableActionSBT",
    abiFileName: "ValuableActionSBT.json"
  },
  commerceDisputes: {
    targetVariable: "commerceDisputes",
    targetKey: "commerceDisputes",
    contractName: "CommerceDisputes",
    abiFileName: "CommerceDisputes.json"
  },
  housingManager: {
    targetVariable: "housingManager",
    targetKey: "housingManager",
    contractName: "HousingManager",
    abiFileName: "HousingManager.json"
  },
  draftsManager: {
    targetVariable: "draftsManager",
    targetKey: "draftsManager",
    contractName: "DraftsManager",
    abiFileName: "DraftsManager.json"
  }
};

export function getPermissionMatrixTargets(): Record<string, PermissionMatrixContractTarget> {
  return TARGETS;
}

export function canonicalizeSignature(signature: string): string {
  return signature.replace(/\s+/g, "").trim();
}

export function selectorFromSignature(signature: string): string {
  const normalized = canonicalizeSignature(signature);
  return `${keccak256(toBytes(normalized)).slice(0, 10)}`;
}

function lineNumberAtIndex(input: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (input.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function collectSignatures(rawBlock: string): string[] {
  const signatures: string[] = [];
  const regex = /"([^"]+)"/g;
  let match = regex.exec(rawBlock);
  while (match) {
    signatures.push(canonicalizeSignature(match[1]));
    match = regex.exec(rawBlock);
  }
  return signatures;
}

export function extractSelectorRoleAssignments(source: string): ParsedSelectorRoleAssignment[] {
  const start = source.indexOf(ASSIGNMENT_START);
  if (start < 0) throw new Error("selectorRoleAssignments block not found");

  const end = source.indexOf(ASSIGNMENT_END, start);
  if (end < 0) throw new Error("selectorRoleAssignments terminator not found");

  const block = source.slice(start, end);
  const assignments: ParsedSelectorRoleAssignment[] = [];
  const objectRegex = /\{\s*target:\s*([^,]+),\s*role:\s*([^,]+),\s*signatures:\s*\[([\s\S]*?)\]\s*\}/g;

  let match = objectRegex.exec(block);
  while (match) {
    assignments.push({
      targetVariable: match[1].trim(),
      roleExpression: match[2].trim(),
      signatures: collectSignatures(match[3]),
      sourceLine: lineNumberAtIndex(source, start + match.index)
    });
    match = objectRegex.exec(block);
  }

  if (assignments.length === 0) {
    throw new Error("No selectorRoleAssignments entries parsed");
  }

  return assignments;
}

function resolveRoleName(roleExpression: string): RoleName {
  if (roleExpression === "adminRole") return "ADMIN_ROLE";
  return roleExpression;
}

function sortEntries(entries: PermissionMatrixEntry[]): PermissionMatrixEntry[] {
  return [...entries].sort((a, b) => {
    return (
      a.targetKey.localeCompare(b.targetKey) ||
      a.selector.localeCompare(b.selector) ||
      a.signature.localeCompare(b.signature) ||
      a.roleName.localeCompare(b.roleName) ||
      a.sourceLine - b.sourceLine
    );
  });
}

export function buildPermissionMatrix(
  source: string,
  sourceFile: string,
  customTargets?: Record<string, PermissionMatrixContractTarget>
): PermissionMatrixBuildResult {
  const targets = customTargets ?? TARGETS;
  const assignments = extractSelectorRoleAssignments(source);
  const unknownTargets = new Set<string>();
  const rows: PermissionMatrixEntry[] = [];

  for (const assignment of assignments) {
    const target = targets[assignment.targetVariable];
    if (!target) {
      unknownTargets.add(assignment.targetVariable);
      continue;
    }

    const roleName = resolveRoleName(assignment.roleExpression);
    for (const signature of assignment.signatures) {
      rows.push({
        contractName: target.contractName,
        targetKey: target.targetKey,
        targetVariable: assignment.targetVariable,
        signature,
        selector: selectorFromSignature(signature),
        roleName,
        roleValue: assignment.roleExpression,
        sourceFile,
        sourceLine: assignment.sourceLine
      });
    }
  }

  const collisions: PermissionMatrixFailure[] = [];
  const deduped = new Map<string, PermissionMatrixEntry>();
  const byTargetSelector = new Map<string, PermissionMatrixEntry>();

  for (const row of rows) {
    const exactKey = [row.targetKey, row.selector, row.signature, row.roleName, row.roleValue].join("|");
    if (!deduped.has(exactKey)) {
      deduped.set(exactKey, row);
    }

    const selectorKey = `${row.targetKey}|${row.selector}`;
    const existing = byTargetSelector.get(selectorKey);
    if (!existing) {
      byTargetSelector.set(selectorKey, row);
      continue;
    }

    const isSame =
      existing.signature === row.signature &&
      existing.roleName === row.roleName &&
      existing.roleValue === row.roleValue;

    if (!isSame) {
      collisions.push({
        contractName: row.contractName,
        targetKey: row.targetKey,
        signature: row.signature,
        selector: row.selector,
        reason: "selector_mismatch"
      });
    }
  }

  return {
    entries: sortEntries([...deduped.values()]),
    collisions: sortFailures(collisions),
    unknownTargets: [...unknownTargets].sort((a, b) => a.localeCompare(b))
  };
}

function formatAbiParamType(input: { type: string; components?: Array<{ type: string; components?: unknown[] }> }): string {
  if (input.type === "tuple") {
    const components = Array.isArray(input.components) ? input.components : [];
    return `(${components.map((component) => formatAbiParamType(component as { type: string; components?: Array<{ type: string; components?: unknown[] }> })).join(",")})`;
  }
  if (input.type === "tuple[]") {
    const components = Array.isArray(input.components) ? input.components : [];
    return `(${components.map((component) => formatAbiParamType(component as { type: string; components?: Array<{ type: string; components?: unknown[] }> })).join(",")})[]`;
  }
  return input.type;
}

export function buildAbiFunctionLookup(abiArtifact: unknown): AbiFunctionLookup {
  if (!abiArtifact || typeof abiArtifact !== "object" || !("abi" in abiArtifact)) {
    throw new Error("Invalid ABI artifact shape");
  }

  const signatures = new Set<string>();
  const selectorBySignature = new Map<string, string>();
  const abiItems = (abiArtifact as { abi: Array<Record<string, unknown>> }).abi;

  for (const item of abiItems) {
    if (item.type !== "function") continue;
    const name = String(item.name ?? "");
    const inputs = Array.isArray(item.inputs) ? item.inputs : [];
    const signature = `${name}(${inputs
      .map((input) => formatAbiParamType(input as { type: string; components?: Array<{ type: string; components?: unknown[] }> }))
      .join(",")})`;
    const normalized = canonicalizeSignature(signature);
    signatures.add(normalized);
    selectorBySignature.set(normalized, selectorFromSignature(normalized));
  }

  return { signatures, selectorBySignature };
}

function sortFailures(failures: PermissionMatrixFailure[]): PermissionMatrixFailure[] {
  return [...failures].sort((a, b) => {
    return (
      a.targetKey.localeCompare(b.targetKey) ||
      a.selector.localeCompare(b.selector) ||
      a.signature.localeCompare(b.signature) ||
      a.reason.localeCompare(b.reason)
    );
  });
}

export function validatePermissionMatrixEntries(
  entries: PermissionMatrixEntry[],
  loadAbiArtifact: (targetKey: string) => unknown | null
): PermissionMatrixFailure[] {
  const failures: PermissionMatrixFailure[] = [];
  const lookupCache = new Map<string, AbiFunctionLookup | null>();

  for (const entry of entries) {
    if (!lookupCache.has(entry.targetKey)) {
      const artifact = loadAbiArtifact(entry.targetKey);
      if (!artifact) {
        lookupCache.set(entry.targetKey, null);
      } else {
        lookupCache.set(entry.targetKey, buildAbiFunctionLookup(artifact));
      }
    }

    const lookup = lookupCache.get(entry.targetKey);
    if (!lookup) {
      failures.push({
        contractName: entry.contractName,
        targetKey: entry.targetKey,
        signature: entry.signature,
        selector: entry.selector,
        reason: "artifact_missing"
      });
      continue;
    }

    const normalized = canonicalizeSignature(entry.signature);
    if (!lookup.signatures.has(normalized)) {
      failures.push({
        contractName: entry.contractName,
        targetKey: entry.targetKey,
        signature: entry.signature,
        selector: entry.selector,
        reason: "signature_not_found"
      });
      continue;
    }

    const expectedSelector = lookup.selectorBySignature.get(normalized);
    if (expectedSelector !== entry.selector) {
      failures.push({
        contractName: entry.contractName,
        targetKey: entry.targetKey,
        signature: entry.signature,
        selector: entry.selector,
        reason: "selector_mismatch"
      });
    }
  }

  return sortFailures(failures);
}
