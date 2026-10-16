import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ACCESS_WIRING_CHECKS,
  evaluateAccessInspection,
  moduleKeyForTarget,
  type AccessReadResults
} from "../../../lib/community-overview/access-inspection";
import type { CommunityModules } from "../../../hooks/useCommunityModules";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const ADMIN = 0n;

function fullModules(): CommunityModules {
  const keys = new Set(ACCESS_WIRING_CHECKS.map((c) => c.targetKey));
  const modules: Record<string, `0x${string}`> = { accessManager: addr(1), timelock: addr(2) };
  let i = 10;
  for (const key of keys) modules[moduleKeyForTarget(key)] = addr(i++);
  return modules as CommunityModules;
}

function healthyReads(modules: CommunityModules): AccessReadResults {
  const functionRoles: AccessReadResults["functionRoles"] = {};
  const timelockHasRole: AccessReadResults["timelockHasRole"] = {};
  ACCESS_WIRING_CHECKS.forEach((check, index) => {
    const expected = check.role === "ADMIN" ? ADMIN : BigInt(check.role);
    functionRoles[index] = expected;
    timelockHasRole[expected.toString()] = true;
  });
  void modules;
  return { adminRole: ADMIN, functionRoles, timelockHasRole };
}

describe("access inspection", () => {
  it("mirrors the canonical verify-access-wiring.mjs check list", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../scripts/verify-access-wiring.mjs"), "utf8");
    const scriptChecks = [...source.matchAll(/\{ targetKey: "(\w+)", signature: "([^"]+)", role: ([\w]+|"ADMIN") \}/g)].map(
      (m) => `${m[1]}|${m[2]}`
    );
    expect(scriptChecks.length).toBeGreaterThan(50);
    expect(ACCESS_WIRING_CHECKS.map((c) => `${c.targetKey}|${c.signature}`)).toEqual(scriptChecks);
  });

  it("passes when every selector role matches and timelock holds the roles", () => {
    const modules = fullModules();
    const result = evaluateAccessInspection(modules, healthyReads(modules));
    expect(result.overall).toBe("pass");
    expect(result.timelockAdmin).toBe("pass");
    expect(result.rows.every((r) => r.status === "pass")).toBe(true);
  });

  it("fails when a selector is bound to the wrong role", () => {
    const modules = fullModules();
    const reads = healthyReads(modules);
    reads.functionRoles[0] = 999n;
    const result = evaluateAccessInspection(modules, reads);
    expect(result.rows[0].status).toBe("fail");
    expect(result.overall).toBe("fail");
  });

  it("fails an ADMIN-gated row when the timelock lacks the admin role", () => {
    const modules = fullModules();
    const reads = healthyReads(modules);
    reads.timelockHasRole[ADMIN.toString()] = false;
    const result = evaluateAccessInspection(modules, reads);
    expect(result.timelockAdmin).toBe("fail");
    expect(result.overall).toBe("fail");
  });

  it("resolves the engagements target to the engagementsManager module", () => {
    const modules = fullModules();
    const result = evaluateAccessInspection(modules, healthyReads(modules));
    const row = result.rows.find((r) => r.targetKey === "engagements");
    expect(row?.target).toBe(modules.engagementsManager);
    expect(row?.status).toBe("pass");
  });

  it("is unavailable (never pass) when a read failed", () => {
    const modules = fullModules();
    const reads = healthyReads(modules);
    reads.functionRoles[3] = null;
    const result = evaluateAccessInspection(modules, reads);
    expect(result.rows[3].status).toBe("unavailable");
    expect(result.overall).toBe("unavailable");
  });

  it("is unavailable when the target module address is missing", () => {
    const modules = fullModules();
    delete modules.marketplace;
    const result = evaluateAccessInspection(modules, healthyReads(modules));
    const row = result.rows.find((r) => r.targetKey === "marketplace");
    expect(row?.status).toBe("unavailable");
    expect(result.overall).toBe("unavailable");
  });

  it("is unavailable without reads or access manager, and fail beats unavailable", () => {
    expect(evaluateAccessInspection(null, null).overall).toBe("unavailable");
    const modules = fullModules();
    const reads = healthyReads(modules);
    reads.functionRoles[0] = 999n;
    reads.functionRoles[1] = null;
    expect(evaluateAccessInspection(modules, reads).overall).toBe("fail");
  });
});
