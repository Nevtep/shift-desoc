import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AllowlistTarget = {
  targetId: string;
  contractName: string;
  signatures: string[];
};

type TimelockAllowlistProfile = {
  profileId: "base-sepolia-v1";
  source: {
    wiringFile: string;
    selectionRule: string;
    generatedAt: string;
    generatorVersion: string;
  };
  targets: AllowlistTarget[];
};

type TimelockAllowlistMeta = {
  profileId: string;
  generatedAt: string;
  generatorVersion: string;
  profileHash: string;
  targetCount: number;
  signatureCount: number;
  ignoredNonAdminAssignments: number;
  skippedTargets: string[];
  overloadNames: Record<string, string[]>;
  abiValidationFailures: string[];
};

type JsonObject = Record<string, unknown>;

type PermissionMatrixEntry = {
  contractName: string;
  targetKey: string;
  targetVariable: string;
  signature: string;
  selector: string;
  roleName: string;
  roleValue: string;
  sourceFile: string;
  sourceLine: number;
};

type PermissionMatrixFailure = {
  contractName: string;
  targetKey: string;
  signature: string;
  selector: string;
  reason: "signature_not_found" | "selector_mismatch" | "artifact_missing";
};

type PermissionMatrixTarget = {
  targetVariable: string;
  targetKey: string;
  contractName: string;
  abiFileName: string;
};

const ROOT = process.cwd();
const FEATURE_DIR = path.join(ROOT, "specs/010-wizard-permission-parity");
const CONTRACTS_DIR = path.join(FEATURE_DIR, "contracts");
const SOURCE_FILE = path.join(ROOT, "apps/web/lib/deploy/factory-step-executor.ts");
const ABI_DIR = path.join(ROOT, "apps/web/abis");
const OUTPUT_DIR = path.join(ROOT, "apps/web/lib/actions/allowlists");

const OUTPUT_FILES = {
  allowlistProfile: path.join(OUTPUT_DIR, "base-sepolia-v1.json"),
  allowlistMeta: path.join(OUTPUT_DIR, "base-sepolia-v1.meta.json"),
  permissionMatrix: path.join(CONTRACTS_DIR, "permission-matrix.json"),
  signatureNotFound: path.join(CONTRACTS_DIR, "signature-not-found.json"),
  timelockSurface: path.join(CONTRACTS_DIR, "timelock-surface.json"),
  crucialFlowsCatalog: path.join(CONTRACTS_DIR, "crucial-flows-catalog.json")
} as const;

const SCHEMA_FILES = {
  permissionMatrix: path.join(CONTRACTS_DIR, "permission-matrix.schema.json"),
  signatureNotFound: path.join(CONTRACTS_DIR, "signature-not-found.schema.json"),
  timelockSurface: path.join(CONTRACTS_DIR, "timelock-surface.schema.json"),
  crucialFlowsCatalog: path.join(CONTRACTS_DIR, "crucial-flows-catalog.schema.json")
} as const;

function isObject(input: unknown): input is JsonObject {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function stableSortObject(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => stableSortObject(item));
  if (isObject(input)) {
    return Object.keys(input)
      .sort((a, b) => a.localeCompare(b))
      .reduce<JsonObject>((acc, key) => {
        acc[key] = stableSortObject(input[key]);
        return acc;
      }, {});
  }
  return input;
}

function stringifyDeterministic(value: unknown): string {
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

function assertSchemaFilePresent(schemaName: keyof typeof SCHEMA_FILES, raw: string): void {
  if (!raw.includes("\"$schema\"")) {
    throw new Error(`Invalid schema file for ${schemaName}`);
  }
}

function validatePermissionMatrixArtifact(value: unknown): void {
  if (!isObject(value) || typeof value.version !== "string" || !Array.isArray(value.entries)) {
    throw new Error("permission-matrix.json schema validation failed");
  }
  for (const entry of value.entries) {
    if (!isObject(entry)) throw new Error("permission-matrix.json schema validation failed");
    const sourceLine = entry.sourceLine;
    if (
      typeof entry.contractName !== "string" ||
      typeof entry.targetKey !== "string" ||
      typeof entry.targetVariable !== "string" ||
      typeof entry.signature !== "string" ||
      typeof entry.selector !== "string" ||
      typeof entry.roleName !== "string" ||
      typeof entry.roleValue !== "string" ||
      typeof entry.sourceFile !== "string" ||
      typeof sourceLine !== "number" ||
      sourceLine < 1
    ) {
      throw new Error("permission-matrix.json schema validation failed");
    }
  }
}

function validateSignatureFailureArtifact(value: unknown): void {
  if (!isObject(value) || typeof value.version !== "string" || !Array.isArray(value.failures)) {
    throw new Error("signature-not-found.json schema validation failed");
  }
  for (const failure of value.failures) {
    if (!isObject(failure)) throw new Error("signature-not-found.json schema validation failed");
    if (
      typeof failure.contractName !== "string" ||
      typeof failure.targetKey !== "string" ||
      typeof failure.signature !== "string" ||
      typeof failure.selector !== "string" ||
      (failure.reason !== "signature_not_found" && failure.reason !== "selector_mismatch" && failure.reason !== "artifact_missing")
    ) {
      throw new Error("signature-not-found.json schema validation failed");
    }
  }
}

function validateTimelockSurfaceArtifact(value: unknown): void {
  if (!isObject(value) || typeof value.version !== "string" || typeof value.handoffVerified !== "boolean" || !Array.isArray(value.contracts)) {
    throw new Error("timelock-surface.json schema validation failed");
  }
  for (const contract of value.contracts) {
    if (!isObject(contract)) throw new Error("timelock-surface.json schema validation failed");
    if (
      typeof contract.contractName !== "string" ||
      typeof contract.targetKey !== "string" ||
      !Array.isArray(contract.signatures) ||
      !Array.isArray(contract.selectors) ||
      contract.signatures.length === 0 ||
      contract.selectors.length === 0
    ) {
      throw new Error("timelock-surface.json schema validation failed");
    }
  }
}

function validateCrucialFlowsCatalogArtifact(value: unknown): void {
  if (!isObject(value) || typeof value.version !== "string" || !Array.isArray(value.flows)) {
    throw new Error("crucial-flows-catalog.json schema validation failed");
  }
  const validLayers = new Set(["coordination", "governance", "verification", "economy", "commerce_housing"]);
  for (const flow of value.flows) {
    if (!isObject(flow)) throw new Error("crucial-flows-catalog.json schema validation failed");
    if (
      !validLayers.has(String(flow.layer)) ||
      typeof flow.flowId !== "string" ||
      typeof flow.targetKey !== "string" ||
      typeof flow.signature !== "string" ||
      typeof flow.templateId !== "string" ||
      typeof flow.enabled !== "boolean"
    ) {
      throw new Error("crucial-flows-catalog.json schema validation failed");
    }
    if (flow.enabled === true && flow.disabledReason !== null) {
      throw new Error("crucial-flows-catalog.json schema validation failed");
    }
    if (flow.enabled === false && (typeof flow.disabledReason !== "string" || flow.disabledReason.length === 0)) {
      throw new Error("crucial-flows-catalog.json schema validation failed");
    }
  }
}

async function loadJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function loadAbiArtifactByTarget(
  targetKey: string,
  targets: Record<string, PermissionMatrixTarget>
): Promise<unknown | null> {
  const target = Object.values(targets).find((entry) => entry.targetKey === targetKey);
  if (!target) return null;
  try {
    return await loadJson(path.join(ABI_DIR, target.abiFileName));
  } catch {
    return null;
  }
}

function flattenFailureMessages(failures: PermissionMatrixFailure[]): string[] {
  return failures.map((failure) => `${failure.targetKey}: ${failure.reason} for ${failure.signature}`);
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildProfileFromSurface(contracts: Array<{ contractName: string; targetKey: string; signatures: string[] }>): TimelockAllowlistProfile {
  const targets = contracts
    .map((contract) => ({
      targetId: contract.targetKey,
      contractName: contract.contractName,
      signatures: sortUnique(contract.signatures)
    }))
    .sort((a, b) => a.targetId.localeCompare(b.targetId));

  return {
    profileId: "base-sepolia-v1",
    source: {
      wiringFile: "apps/web/lib/deploy/factory-step-executor.ts",
      selectionRule: "ADMIN_ROLE signatures with verified Timelock handoff",
      generatedAt: "1970-01-01T00:00:00.000Z",
      generatorVersion: "2"
    },
    targets
  };
}

function extractOverloadNames(abiArtifact: unknown): string[] {
  if (!isObject(abiArtifact) || !Array.isArray(abiArtifact.abi)) return [];
  const counts = new Map<string, number>();
  for (const item of abiArtifact.abi) {
    if (!isObject(item) || item.type !== "function") continue;
    const name = String(item.name ?? "");
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1)
    .map((entry) => entry[0])
    .sort((a, b) => a.localeCompare(b));
}

function countIgnoredNonAdminAssignments(
  source: string,
  extractor: (sourceText: string) => Array<{ roleExpression: string }>
): number {
  return extractor(source).filter((assignment) => assignment.roleExpression !== "adminRole").length;
}

function buildFailureArtifact(failures: PermissionMatrixFailure[]): { version: string; failures: PermissionMatrixFailure[] } {
  return {
    version: "1",
    failures
  };
}

function buildPermissionMatrixArtifact(entries: PermissionMatrixEntry[]): { version: string; entries: PermissionMatrixEntry[] } {
  return {
    version: "1",
    entries
  };
}

async function main() {
  const permissionMatrixModule = await import(
    pathToFileURL(path.join(ROOT, "apps/web/lib/actions/permission-matrix.ts")).href
  );
  const timelockSurfaceModule = await import(
    pathToFileURL(path.join(ROOT, "apps/web/lib/actions/timelock-surface.ts")).href
  );

  const sourceRaw = await readFile(SOURCE_FILE, "utf8");
  const matrix = permissionMatrixModule.buildPermissionMatrix(
    sourceRaw,
    "apps/web/lib/deploy/factory-step-executor.ts"
  ) as {
    entries: PermissionMatrixEntry[];
    collisions: PermissionMatrixFailure[];
    unknownTargets: string[];
  };
  const targets = permissionMatrixModule.getPermissionMatrixTargets() as Record<string, PermissionMatrixTarget>;

  const abiArtifactMap = new Map<string, unknown | null>();
  for (const target of Object.values(targets)) {
    if (abiArtifactMap.has(target.targetKey)) continue;
    abiArtifactMap.set(target.targetKey, await loadAbiArtifactByTarget(target.targetKey, targets));
  }

  const abiFailures = (permissionMatrixModule.validatePermissionMatrixEntries(
    matrix.entries,
    (targetKey: string) => {
      return abiArtifactMap.get(targetKey) ?? null;
    }
  ) ?? []) as PermissionMatrixFailure[];

  const failures = [...matrix.collisions, ...abiFailures]
    .sort((a, b) => a.targetKey.localeCompare(b.targetKey) || a.selector.localeCompare(b.selector) || a.reason.localeCompare(b.reason));

  const permissionMatrixArtifact = buildPermissionMatrixArtifact(matrix.entries);
  validatePermissionMatrixArtifact(permissionMatrixArtifact);

  const signatureFailureArtifact = buildFailureArtifact(failures);
  validateSignatureFailureArtifact(signatureFailureArtifact);

  const handoffEvidence = timelockSurfaceModule.deriveStaticHandoffEvidence(sourceRaw) as {
    handoffVerified: boolean;
  };
  const timelockSurfaceArtifact = timelockSurfaceModule.deriveTimelockSurface(
    matrix.entries,
    handoffEvidence.handoffVerified
  ) as {
    version: string;
    handoffVerified: boolean;
    contracts: Array<{ contractName: string; targetKey: string; signatures: string[]; selectors: string[] }>;
  };
  validateTimelockSurfaceArtifact(timelockSurfaceArtifact);

  const crucialFlowsCatalog = await loadJson(OUTPUT_FILES.crucialFlowsCatalog);
  validateCrucialFlowsCatalogArtifact(crucialFlowsCatalog);

  const schemaFiles = await Promise.all(Object.entries(SCHEMA_FILES).map(async ([name, filePath]) => ({
    name,
    raw: await readFile(filePath, "utf8")
  })));
  for (const schemaFile of schemaFiles) {
    assertSchemaFilePresent(schemaFile.name as keyof typeof SCHEMA_FILES, schemaFile.raw);
  }

  const profile = buildProfileFromSurface(timelockSurfaceArtifact.contracts);
  const signatureCount = profile.targets.reduce((acc, target) => acc + target.signatures.length, 0);
  const profileHash = createHash("sha256").update(stringifyDeterministic(profile)).digest("hex");

  const overloadNames: Record<string, string[]> = {};
  for (const target of profile.targets) {
    const artifact = await loadAbiArtifactByTarget(target.targetId, targets);
    overloadNames[target.targetId] = extractOverloadNames(artifact);
  }

  const metadata: TimelockAllowlistMeta = {
    profileId: profile.profileId,
    generatedAt: profile.source.generatedAt,
    generatorVersion: profile.source.generatorVersion,
    profileHash,
    targetCount: profile.targets.length,
    signatureCount,
    ignoredNonAdminAssignments: countIgnoredNonAdminAssignments(
      sourceRaw,
      permissionMatrixModule.extractSelectorRoleAssignments as (sourceText: string) => Array<{ roleExpression: string }>
    ),
    skippedTargets: matrix.unknownTargets,
    overloadNames,
    abiValidationFailures: flattenFailureMessages(failures)
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILES.permissionMatrix, stringifyDeterministic(permissionMatrixArtifact), "utf8");
  await writeFile(OUTPUT_FILES.signatureNotFound, stringifyDeterministic(signatureFailureArtifact), "utf8");
  await writeFile(OUTPUT_FILES.timelockSurface, stringifyDeterministic(timelockSurfaceArtifact), "utf8");

  if (failures.length > 0 || !handoffEvidence.handoffVerified) {
    throw new Error(
      [
        "Permission matrix validation failed",
        ...flattenFailureMessages(failures),
        ...(handoffEvidence.handoffVerified ? [] : ["handoff_not_verified"])
      ].join("\n")
    );
  }

  await writeFile(OUTPUT_FILES.allowlistProfile, stringifyDeterministic(profile), "utf8");
  await writeFile(OUTPUT_FILES.allowlistMeta, stringifyDeterministic(metadata), "utf8");

  console.log(`Generated ${OUTPUT_FILES.permissionMatrix}`);
  console.log(`Generated ${OUTPUT_FILES.signatureNotFound}`);
  console.log(`Generated ${OUTPUT_FILES.timelockSurface}`);
  console.log(`Generated ${OUTPUT_FILES.allowlistProfile}`);
  console.log(`Generated ${OUTPUT_FILES.allowlistMeta}`);
  console.log(`Targets: ${metadata.targetCount}, signatures: ${metadata.signatureCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
