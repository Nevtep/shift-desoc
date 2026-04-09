import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildPermissionMatrix } from "../../../../lib/actions/permission-matrix";
import { deriveStaticHandoffEvidence, deriveTimelockSurface } from "../../../../lib/actions/timelock-surface";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../../../");

describe("timelock-surface", () => {
  it("derives ADMIN_ROLE-only contracts when handoff is verified", async () => {
    const source = await readFile(path.join(ROOT, "apps/web/lib/deploy/factory-step-executor.ts"), "utf8");
    const matrix = buildPermissionMatrix(source, "apps/web/lib/deploy/factory-step-executor.ts");
    const evidence = deriveStaticHandoffEvidence(source);
    const surface = deriveTimelockSurface(matrix.entries, evidence.handoffVerified);

    expect(surface.handoffVerified).toBe(true);
    expect(surface.contracts.length).toBeGreaterThan(5);
    expect(surface.contracts.find((entry) => entry.targetKey === "treasuryAdapter")?.signatures).toContain(
      "setCapBps(address,uint16)"
    );
    expect(surface.contracts.some((entry) => entry.targetKey === "valuableActionSBT")).toBe(false);
  });

  it("returns empty surface when handoff verification fails", () => {
    const matrix = {
      entries: [
        {
          contractName: "TreasuryAdapter",
          targetKey: "treasuryAdapter",
          targetVariable: "treasuryAdapter",
          signature: "setTokenAllowed(address,bool)",
          selector: "0x80f95fd4",
          roleName: "ADMIN_ROLE",
          roleValue: "adminRole",
          sourceFile: "apps/web/lib/deploy/factory-step-executor.ts",
          sourceLine: 1
        }
      ]
    };

    const surface = deriveTimelockSurface(matrix.entries, false);
    expect(surface.handoffVerified).toBe(false);
    expect(surface.contracts).toEqual([]);
  });

  it("extracts static handoff evidence anchors", async () => {
    const source = await readFile(path.join(ROOT, "apps/web/lib/deploy/factory-step-executor.ts"), "utf8");
    const evidence = deriveStaticHandoffEvidence(source);

    expect(evidence.timelockGrantFound).toBe(true);
    expect(evidence.deployerRevokeFound).toBe(true);
    expect(evidence.timelockPostCheckFound).toBe(true);
    expect(evidence.handoffVerified).toBe(true);
  });
});
