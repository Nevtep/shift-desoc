import type { PermissionMatrixEntry } from "./permission-matrix";

export type HandoffEvidence = {
  timelockGrantFound: boolean;
  bootstrapRevokeFound: boolean;
  deployerRevokeFound: boolean;
  timelockPostCheckFound: boolean;
  deployerPostCheckFound: boolean;
  handoffVerified: boolean;
};

export type TimelockSurfaceContract = {
  contractName: string;
  targetKey: string;
  signatures: string[];
  selectors: string[];
};

export type TimelockSurfaceArtifact = {
  version: string;
  handoffVerified: boolean;
  contracts: TimelockSurfaceContract[];
};

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function deriveStaticHandoffEvidence(source: string): HandoffEvidence {
  const timelockGrantFound = source.includes("functionName: \"grantRole\"") && source.includes("args: [adminRole, timelock, 0]");
  const bootstrapRevokeFound = source.includes("resolveBootstrapCoordinatorAddress") && source.includes("args: [adminRole, bootstrapCoordinator]");
  const deployerRevokeFound = source.includes("args: [adminRole, handoffFrom]");
  const timelockPostCheckFound = source.includes("Admin handoff failed: timelock missing admin role after handoff.");
  const deployerPostCheckFound = source.includes("Admin handoff failed: deployer wallet still has admin role.");

  return {
    timelockGrantFound,
    bootstrapRevokeFound,
    deployerRevokeFound,
    timelockPostCheckFound,
    deployerPostCheckFound,
    handoffVerified:
      timelockGrantFound &&
      bootstrapRevokeFound &&
      deployerRevokeFound &&
      timelockPostCheckFound &&
      deployerPostCheckFound
  };
}

export function deriveTimelockSurface(entries: PermissionMatrixEntry[], handoffVerified: boolean): TimelockSurfaceArtifact {
  if (!handoffVerified) {
    return {
      version: "1",
      handoffVerified: false,
      contracts: []
    };
  }

  const grouped = new Map<string, { contractName: string; targetKey: string; signatures: string[]; selectors: string[] }>();
  for (const entry of entries) {
    if (entry.roleName !== "ADMIN_ROLE") continue;
    const key = `${entry.contractName}|${entry.targetKey}`;
    const current = grouped.get(key) ?? {
      contractName: entry.contractName,
      targetKey: entry.targetKey,
      signatures: [],
      selectors: []
    };
    current.signatures.push(entry.signature);
    current.selectors.push(entry.selector);
    grouped.set(key, current);
  }

  const contracts = [...grouped.values()]
    .map((value) => ({
      contractName: value.contractName,
      targetKey: value.targetKey,
      signatures: sortUnique(value.signatures),
      selectors: sortUnique(value.selectors)
    }))
    .sort((a, b) => a.targetKey.localeCompare(b.targetKey) || a.contractName.localeCompare(b.contractName));

  return {
    version: "1",
    handoffVerified: true,
    contracts
  };
}
