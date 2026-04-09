import profileJson from "./allowlists/base-sepolia-v1.json" assert { type: "json" };
import profileMetaJson from "./allowlists/base-sepolia-v1.meta.json" assert { type: "json" };

export type AllowlistTargetId =
  | "commerceDisputes"
  | "valuableActionRegistry"
  | "engagements"
  | "verifierElection"
  | "verifierManager"
  | "verifierPowerToken"
  | "membershipToken"
  | "valuableActionSBT"
  | "revenueRouter"
  | "treasuryAdapter"
  | "marketplace"
  | "housingManager"
  | "paramController"
  | "draftsManager"
  | "cohortRegistry"
  | "investmentCohortManager"
  | "positionManager"
  | "credentialManager"
  | "communityRegistry";

export type AllowlistTargetEntry = {
  targetId: AllowlistTargetId;
  contractName: string;
  signatures: string[];
};

export type TimelockAllowlistProfile = {
  profileId: "base-sepolia-v1";
  source: {
    wiringFile: string;
    selectionRule: string;
    generatedAt: string;
    generatorVersion: string;
  };
  targets: AllowlistTargetEntry[];
};

export type TimelockAllowlistMeta = {
  profileId: string;
  generatedAt: string;
  targetCount: number;
  signatureCount: number;
  ignoredNonAdminAssignments: number;
  skippedTargets: string[];
  overloadNames: Record<string, string[]>;
  abiValidationFailures: string[];
};

const PROFILES = [profileJson as TimelockAllowlistProfile] as const;
const PROFILE_META = profileMetaJson as TimelockAllowlistMeta;
const CANONICAL_PROFILE_ID = "base-sepolia-v1" as const;

function assertSortedUnique(list: string[], label: string) {
  for (let i = 0; i < list.length; i += 1) {
    if (!list[i]) {
      throw new Error(`Invalid allowlist ${label}: empty signature at index ${i}`);
    }
    if (i === 0) continue;
    if (list[i - 1] === list[i]) {
      throw new Error(`Invalid allowlist ${label}: duplicate signature ${list[i]}`);
    }
    if (list[i - 1] > list[i]) {
      throw new Error(`Invalid allowlist ${label}: signatures must be sorted`);
    }
  }
}

function validateProfile(profile: TimelockAllowlistProfile): TimelockAllowlistProfile {
  if (profile.profileId !== CANONICAL_PROFILE_ID) {
    throw new Error(`Unexpected allowlist profile id: ${profile.profileId}`);
  }

  const seenTargets = new Set<string>();
  for (let i = 0; i < profile.targets.length; i += 1) {
    const target = profile.targets[i];
    if (!target.targetId || !target.contractName) {
      throw new Error(`Invalid allowlist target entry at index ${i}`);
    }
    if (seenTargets.has(target.targetId)) {
      throw new Error(`Duplicate allowlist target: ${target.targetId}`);
    }
    seenTargets.add(target.targetId);
    assertSortedUnique(target.signatures, target.targetId);
  }

  const targetCount = profile.targets.length;
  const signatureCount = profile.targets.reduce((acc, target) => acc + target.signatures.length, 0);
  if (PROFILE_META.targetCount !== targetCount) {
    throw new Error(
      `Allowlist metadata targetCount mismatch: expected ${targetCount}, got ${PROFILE_META.targetCount}`
    );
  }
  if (PROFILE_META.signatureCount !== signatureCount) {
    throw new Error(
      `Allowlist metadata signatureCount mismatch: expected ${signatureCount}, got ${PROFILE_META.signatureCount}`
    );
  }
  if (PROFILE_META.abiValidationFailures.length > 0) {
    throw new Error(`Allowlist metadata reports ABI validation failures`);
  }

  return profile;
}

const CANONICAL_PROFILE = validateProfile(PROFILES[0]);

if (PROFILES.length !== 1) {
  throw new Error(`Expected exactly one canonical allowlist profile, found ${PROFILES.length}`);
}

export function listAllowlistProfiles(): readonly TimelockAllowlistProfile[] {
  return PROFILES;
}

export function getCanonicalAllowlistProfile(): TimelockAllowlistProfile {
  return CANONICAL_PROFILE;
}

export function getCanonicalAllowlistMeta(): TimelockAllowlistMeta {
  return PROFILE_META;
}

export function getAllowlistedSignatures(targetId: AllowlistTargetId): string[] {
  const target = CANONICAL_PROFILE.targets.find((entry) => entry.targetId === targetId);
  return target ? [...target.signatures] : [];
}

export function getAllowlistedSignatureSet(targetId: AllowlistTargetId): Set<string> {
  return new Set(getAllowlistedSignatures(targetId));
}

export function isAllowlistedSignature(targetId: AllowlistTargetId, signature: string): boolean {
  return getAllowlistedSignatureSet(targetId).has(signature);
}
