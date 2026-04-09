import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Assignment = {
  targetVariable: string;
  roleExpression: string;
  signatures: string[];
};

type TargetSpec = {
  targetId:
    | "valuableActionRegistry"
    | "verifierElection"
    | "verifierPowerToken"
    | "revenueRouter"
    | "treasuryAdapter"
    | "marketplace"
    | "cohortRegistry"
    | "investmentCohortManager"
    | "positionManager"
    | "credentialManager";
  contractName: string;
  abiFileName: string;
  allowedSignatures?: readonly string[];
};

type AllowlistTarget = {
  targetId: string;
  contractName: string;
  signatures: string[];
};

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "apps/web/lib/deploy/factory-step-executor.ts");
const ABI_DIR = path.join(ROOT, "apps/web/abis");
const OUTPUT_DIR = path.join(ROOT, "apps/web/lib/actions/allowlists");
const PROFILE_PATH = path.join(OUTPUT_DIR, "base-sepolia-v1.json");
const META_PATH = path.join(OUTPUT_DIR, "base-sepolia-v1.meta.json");

const TARGET_SPECS: Record<string, TargetSpec> = {
  valuableActionRegistry: {
    targetId: "valuableActionRegistry",
    contractName: "ValuableActionRegistry",
    abiFileName: "ValuableActionRegistry.json",
    allowedSignatures: [
      "activateFromGovernance(uint256,bytes32)",
      "addFounder(address)",
      "deactivate(uint256)",
      "setCommunityIssuanceModule(address,bool)",
      "setCommunityNarrowing(bool)",
      "setIssuanceModule(address,bool)",
      "setIssuancePaused(bool)",
      "setValuableActionSBT(address)"
    ]
  },
  verifierElection: {
    targetId: "verifierElection",
    contractName: "VerifierElection",
    abiFileName: "VerifierElection.json"
  },
  verifierPowerToken: {
    targetId: "verifierPowerToken",
    contractName: "VerifierPowerToken1155",
    abiFileName: "VerifierPowerToken1155.json"
  },
  revenueRouter: {
    targetId: "revenueRouter",
    contractName: "RevenueRouter",
    abiFileName: "RevenueRouter.json"
  },
  treasuryAdapter: {
    targetId: "treasuryAdapter",
    contractName: "TreasuryAdapter",
    abiFileName: "TreasuryAdapter.json",
    allowedSignatures: [
      "setCapBps(address,uint16)",
      "setDestinationAllowed(address,bool)",
      "setTokenAllowed(address,bool)"
    ]
  },
  marketplace: {
    targetId: "marketplace",
    contractName: "Marketplace",
    abiFileName: "Marketplace.json"
  },
  cohortRegistry: {
    targetId: "cohortRegistry",
    contractName: "CohortRegistry",
    abiFileName: "CohortRegistry.json"
  },
  investmentCohortManager: {
    targetId: "investmentCohortManager",
    contractName: "InvestmentCohortManager",
    abiFileName: "InvestmentCohortManager.json"
  },
  positionManager: {
    targetId: "positionManager",
    contractName: "PositionManager",
    abiFileName: "PositionManager.json"
  },
  credentialManager: {
    targetId: "credentialManager",
    contractName: "CredentialManager",
    abiFileName: "CredentialManager.json"
  }
};

function collectSignatures(rawBlock: string): string[] {
  const signatures: string[] = [];
  const regex = /"([^"]+)"/g;
  let match = regex.exec(rawBlock);
  while (match) {
    signatures.push(match[1]);
    match = regex.exec(rawBlock);
  }
  return signatures;
}

function extractSelectorAssignments(source: string): Assignment[] {
  const start = source.indexOf("const selectorRoleAssignments = [");
  if (start < 0) throw new Error("selectorRoleAssignments block not found");

  const end = source.indexOf("] as const;", start);
  if (end < 0) throw new Error("selectorRoleAssignments terminator not found");

  const block = source.slice(start, end);
  const assignments: Assignment[] = [];
  const objectRegex = /\{\s*target:\s*([^,]+),\s*role:\s*([^,]+),\s*signatures:\s*\[([\s\S]*?)\]\s*\}/g;

  let match = objectRegex.exec(block);
  while (match) {
    assignments.push({
      targetVariable: match[1].trim(),
      roleExpression: match[2].trim(),
      signatures: collectSignatures(match[3])
    });
    match = objectRegex.exec(block);
  }

  if (!assignments.length) throw new Error("No selectorRoleAssignments entries parsed");
  return assignments;
}

function formatAbiParamType(input: any): string {
  const rawType = String(input.type ?? "");
  if (rawType === "tuple") {
    const components = Array.isArray(input.components) ? input.components : [];
    const expanded = components.map((component: any) => formatAbiParamType(component));
    return `(${expanded.join(",")})`;
  }
  if (rawType === "tuple[]") {
    const components = Array.isArray(input.components) ? input.components : [];
    const expanded = components.map((component: any) => formatAbiParamType(component));
    return `(${expanded.join(",")})[]`;
  }
  return rawType;
}

function parseAbiSignatures(abiJson: unknown): { signatures: Set<string>; overloadNames: string[] } {
  const signatures = new Set<string>();
  const byName = new Map<string, number>();

  if (!abiJson || typeof abiJson !== "object" || !("abi" in abiJson)) {
    throw new Error("Invalid ABI artifact shape");
  }

  const abi = (abiJson as { abi: Array<Record<string, unknown>> }).abi;
  for (const item of abi) {
    if (item.type !== "function") continue;
    const name = String(item.name ?? "");
    const inputs = Array.isArray(item.inputs) ? item.inputs : [];
    const signature = `${name}(${inputs.map((input) => formatAbiParamType(input)).join(",")})`;
    signatures.add(signature);
    byName.set(name, (byName.get(name) ?? 0) + 1);
  }

  const overloadNames = [...byName.entries()]
    .filter((entry) => entry[1] > 1)
    .map((entry) => entry[0])
    .sort((a, b) => a.localeCompare(b));

  return { signatures, overloadNames };
}

function stringifyDeterministic(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      return Object.keys(obj)
        .sort((a, b) => a.localeCompare(b))
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = stable(obj[key]);
          return acc;
        }, {});
    }
    return input;
  };

  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

async function main() {
  const source = await readFile(SOURCE_FILE, "utf8");
  const assignments = extractSelectorAssignments(source);

  const grouped = new Map<string, Set<string>>();
  let ignoredNonAdminAssignments = 0;
  const skippedTargets = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.roleExpression !== "adminRole") {
      ignoredNonAdminAssignments += 1;
      continue;
    }

    const spec = TARGET_SPECS[assignment.targetVariable];
    if (!spec) {
      skippedTargets.add(assignment.targetVariable);
      continue;
    }

    const signatureSet = grouped.get(spec.targetId) ?? new Set<string>();
    const selected = spec.allowedSignatures
      ? assignment.signatures.filter((signature) => spec.allowedSignatures?.includes(signature))
      : assignment.signatures;

    for (const signature of selected) signatureSet.add(signature);
    grouped.set(spec.targetId, signatureSet);
  }

  const abiValidationFailures: string[] = [];
  const overloadNames: Record<string, string[]> = {};
  const targets: AllowlistTarget[] = [];

  for (const spec of Object.values(TARGET_SPECS).sort((a, b) => a.targetId.localeCompare(b.targetId))) {
    const signatures = [...(grouped.get(spec.targetId) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
    if (!signatures.length) continue;

    const abiRaw = await readFile(path.join(ABI_DIR, spec.abiFileName), "utf8");
    const abiJson = JSON.parse(abiRaw);
    const abiInfo = parseAbiSignatures(abiJson);
    overloadNames[spec.targetId] = abiInfo.overloadNames;

    for (const signature of signatures) {
      if (!abiInfo.signatures.has(signature)) {
        abiValidationFailures.push(`${spec.targetId}: missing ABI signature ${signature}`);
      }
    }

    targets.push({
      targetId: spec.targetId,
      contractName: spec.contractName,
      signatures
    });
  }

  if (abiValidationFailures.length > 0) {
    throw new Error(`ABI reality check failed:\n${abiValidationFailures.join("\n")}`);
  }

  const profile = {
    profileId: "base-sepolia-v1",
    source: {
      wiringFile: "apps/web/lib/deploy/factory-step-executor.ts",
      selectionRule: "ADMIN_ROLE signatures handed to Timelock",
      generatedAt: "1970-01-01T00:00:00.000Z",
      generatorVersion: "1"
    },
    targets
  };

  const signatureCount = targets.reduce((acc, target) => acc + target.signatures.length, 0);
  const profileHash = createHash("sha256").update(stringifyDeterministic(profile)).digest("hex");

  const metadata = {
    profileId: profile.profileId,
    generatedAt: profile.source.generatedAt,
    generatorVersion: profile.source.generatorVersion,
    profileHash,
    targetCount: targets.length,
    signatureCount,
    ignoredNonAdminAssignments,
    skippedTargets: [...skippedTargets].sort((a, b) => a.localeCompare(b)),
    overloadNames,
    abiValidationFailures
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(PROFILE_PATH, stringifyDeterministic(profile), "utf8");
  await writeFile(META_PATH, stringifyDeterministic(metadata), "utf8");

  console.log(`Generated ${PROFILE_PATH}`);
  console.log(`Generated ${META_PATH}`);
  console.log(`Targets: ${targets.length}, signatures: ${signatureCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
