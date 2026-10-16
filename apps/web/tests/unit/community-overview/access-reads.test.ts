import { describe, expect, it } from "vitest";

import { ACCESS_WIRING_CHECKS, evaluateAccessInspection } from "../../../lib/community-overview/access-inspection";
import { readAccessResults } from "../../../lib/community-overview/access-reads";
import type { CommunityModules } from "../../../hooks/useCommunityModules";
import { selectorFromSignature } from "../../../lib/actions/permission-matrix";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const TIMELOCK = addr(2);

function modules(): CommunityModules {
  const m: Record<string, `0x${string}`> = { accessManager: addr(1), timelock: TIMELOCK, engagementsManager: addr(9) };
  let i = 10;
  for (const c of ACCESS_WIRING_CHECKS) if (c.targetKey !== "engagements") m[c.targetKey] ??= addr(i++);
  return m as CommunityModules;
}

function healthyClient(overrides: { fail?: (fn: string, args: readonly unknown[]) => boolean } = {}) {
  const bySelector = new Map<string, bigint>();
  const m = modules();
  for (const c of ACCESS_WIRING_CHECKS) {
    const key = c.targetKey === "engagements" ? "engagementsManager" : c.targetKey;
    bySelector.set(`${(m as any)[key]}:${selectorFromSignature(c.signature)}`, c.role === "ADMIN" ? 0n : BigInt(c.role));
  }
  const calls: string[] = [];
  return {
    calls,
    readContract: async ({ functionName, args = [] }: { functionName: string; args?: readonly unknown[] }) => {
      calls.push(functionName);
      if (overrides.fail?.(functionName, args)) throw new Error("rpc down");
      if (functionName === "ADMIN_ROLE") return 0n;
      if (functionName === "getTargetFunctionRole") return bySelector.get(`${args[0]}:${args[1]}`) ?? 0n;
      if (functionName === "hasRole") return [(args[1] as string) === TIMELOCK, 0];
      throw new Error("unexpected");
    }
  };
}

describe("readAccessResults", () => {
  it("produces a passing inspection from healthy chain reads", async () => {
    const m = modules();
    const reads = await readAccessResults(healthyClient() as any, m);
    expect(evaluateAccessInspection(m, reads).overall).toBe("pass");
  });

  it("marks failed reads null so the inspection is unavailable, not ok", async () => {
    const m = modules();
    const reads = await readAccessResults(healthyClient({ fail: (fn) => fn === "getTargetFunctionRole" }) as any, m);
    expect(evaluateAccessInspection(m, reads).overall).toBe("unavailable");
  });

  it("treats a non-bigint role result as unavailable", async () => {
    const m = modules();
    const client = healthyClient();
    const orig = client.readContract;
    client.readContract = async (a: any) => (a.functionName === "getTargetFunctionRole" ? ("garbage" as any) : orig(a));
    const reads = await readAccessResults(client as any, m);
    expect(evaluateAccessInspection(m, reads).overall).toBe("unavailable");
  });

  it("does not read roles for zero-address targets", async () => {
    const m = { ...modules(), marketplace: "0x0000000000000000000000000000000000000000" as `0x${string}` };
    const client = healthyClient();
    const reads = await readAccessResults(client as any, m);
    const idx = ACCESS_WIRING_CHECKS.findIndex((c) => c.targetKey === "marketplace");
    expect(reads?.functionRoles[idx]).toBeNull();
  });

  it("returns null without access manager or timelock and makes no calls", async () => {
    const client = healthyClient();
    expect(await readAccessResults(client as any, { ...modules(), accessManager: undefined })).toBeNull();
    expect(client.calls).toHaveLength(0);
  });
});
