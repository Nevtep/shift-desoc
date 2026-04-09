import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildPermissionMatrix,
  buildAbiFunctionLookup,
  canonicalizeSignature,
  extractSelectorRoleAssignments,
  selectorFromSignature,
  validatePermissionMatrixEntries
} from "../../../../lib/actions/permission-matrix";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../../../");

describe("permission-matrix", () => {
  it("canonicalizes signatures and selectors deterministically", () => {
    expect(canonicalizeSignature(" setCapBps( address , uint16 ) ")).toBe("setCapBps(address,uint16)");
    expect(selectorFromSignature("setCapBps(address,uint16)")).toBe("0xcb39331f");
  });

  it("parses selectorRoleAssignments from wizard source", async () => {
    const source = await readFile(path.join(ROOT, "apps/web/lib/deploy/factory-step-executor.ts"), "utf8");
    const assignments = extractSelectorRoleAssignments(source);
    expect(assignments.length).toBeGreaterThan(10);
    expect(assignments.some((entry) => entry.targetVariable === "treasuryAdapter")).toBe(true);
  });

  it("builds deterministic deduplicated matrix rows", () => {
    const source = `
const selectorRoleAssignments = [
  {
    target: treasuryAdapter,
    role: adminRole,
    signatures: ["setTokenAllowed(address,bool)", "setTokenAllowed(address,bool)"]
  },
  {
    target: treasuryAdapter,
    role: adminRole,
    signatures: ["setCapBps(address,uint16)"]
  }
] as const;
`;

    const matrix = buildPermissionMatrix(source, "apps/web/lib/deploy/factory-step-executor.ts");
    expect(matrix.collisions).toEqual([]);
    expect(matrix.unknownTargets).toEqual([]);
    expect(matrix.entries.map((entry) => entry.signature)).toEqual([
      "setTokenAllowed(address,bool)",
      "setCapBps(address,uint16)"
    ]);
  });

  it("reports selector collisions when role/signature disagree for same target+selector", () => {
    const source = `
const selectorRoleAssignments = [
  {
    target: treasuryAdapter,
    role: adminRole,
    signatures: ["setTokenAllowed(address,bool)"]
  },
  {
    target: treasuryAdapter,
    role: ROLES.TREASURY_ROLE,
    signatures: ["setTokenAllowed(address,bool)"]
  }
] as const;
`;

    const matrix = buildPermissionMatrix(source, "apps/web/lib/deploy/factory-step-executor.ts");
    expect(matrix.collisions.length).toBe(1);
    expect(matrix.collisions[0]?.reason).toBe("selector_mismatch");
  });

  it("fails closed when ABI artifact is missing", () => {
    const source = `
const selectorRoleAssignments = [
  {
    target: draftsManager,
    role: adminRole,
    signatures: ["setEscalationThreshold(uint256)"]
  }
] as const;
`;

    const matrix = buildPermissionMatrix(source, "apps/web/lib/deploy/factory-step-executor.ts");
    const failures = validatePermissionMatrixEntries(matrix.entries, () => null);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toBe("artifact_missing");
  });

  it("fails closed when signature is not found in ABI", async () => {
    const abiRaw = await readFile(path.join(ROOT, "apps/web/abis/TreasuryAdapter.json"), "utf8");
    const abiJson = JSON.parse(abiRaw) as unknown;
    const lookup = buildAbiFunctionLookup(abiJson);
    expect(lookup.signatures.has("setTokenAllowed(address,bool)")).toBe(true);

    const source = `
const selectorRoleAssignments = [
  {
    target: treasuryAdapter,
    role: adminRole,
    signatures: ["missingFunction(uint256)"]
  }
] as const;
`;

    const matrix = buildPermissionMatrix(source, "apps/web/lib/deploy/factory-step-executor.ts");
    const failures = validatePermissionMatrixEntries(matrix.entries, () => abiJson);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toBe("signature_not_found");
  });
});
