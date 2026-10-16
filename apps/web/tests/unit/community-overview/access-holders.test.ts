import { describe, expect, it } from "vitest";

import { ACCESS_WIRING_CHECKS, evaluateAccessInspection } from "../../../lib/community-overview/access-inspection";
import { readAccessResults } from "../../../lib/community-overview/access-reads";
import type { CommunityModules } from "../../../hooks/useCommunityModules";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const TIMELOCK = addr(2);
const WALLET = addr(77);

function modules(): CommunityModules {
  const m: Record<string, `0x${string}`> = { accessManager: addr(1), timelock: TIMELOCK, engagementsManager: addr(9) };
  let i = 10;
  for (const c of ACCESS_WIRING_CHECKS) if (c.targetKey !== "engagements") m[c.targetKey] ??= addr(i++);
  return m as CommunityModules;
}

function client(opts: { walletAdmin?: boolean; failWallet?: boolean } = {}) {
  return {
    readContract: async ({ functionName, args = [] }: { functionName: string; args?: readonly unknown[] }) => {
      if (functionName === "ADMIN_ROLE") return 0n;
      if (functionName === "getTargetFunctionRole") return 0n;
      if (functionName === "hasRole") {
        if (args[1] === WALLET) {
          if (opts.failWallet) throw new Error("rpc down");
          return [Boolean(opts.walletAdmin), 0];
        }
        return [args[1] === TIMELOCK, 0];
      }
      throw new Error("unexpected");
    }
  };
}

const holder = (i: ReturnType<typeof evaluateAccessInspection>, key: string) => i.holders.find((h) => h.key === key)!;

describe("role holder visibility", () => {
  it("always lists timelock and accessManager addresses", () => {
    const i = evaluateAccessInspection(modules(), null, null);
    expect(holder(i, "accessManager").address).toBe(addr(1));
    expect(holder(i, "timelock").address).toBe(TIMELOCK);
    expect(holder(i, "timelock").state).toBe("unavailable");
  });

  it("marks the bootstrap coordinator explicitly not checked (no browser source)", () => {
    const i = evaluateAccessInspection(modules(), null, null);
    expect(holder(i, "bootstrapCoordinator").state).toBe("not_checked");
    expect(holder(i, "bootstrapCoordinator").address).toBeNull();
  });

  it("marks the connected wallet not checked when no wallet is connected", async () => {
    const m = modules();
    const reads = await readAccessResults(client() as any, m, null);
    expect(holder(evaluateAccessInspection(m, reads, null), "connectedWallet").state).toBe("not_checked");
  });

  it("reports whether the connected wallet holds ADMIN, without affecting overall", async () => {
    const m = modules();
    const yes = await readAccessResults(client({ walletAdmin: true }) as any, m, WALLET);
    const iYes = evaluateAccessInspection(m, yes, WALLET);
    expect(holder(iYes, "connectedWallet")).toMatchObject({ address: WALLET, state: "holds_admin" });
    const no = await readAccessResults(client({ walletAdmin: false }) as any, m, WALLET);
    const iNo = evaluateAccessInspection(m, no, WALLET);
    expect(holder(iNo, "connectedWallet").state).toBe("no_admin");
    expect(iNo.overall).toBe(iYes.overall);
  });

  it("fails closed to unavailable when the wallet read fails or belongs to another wallet", async () => {
    const m = modules();
    const failed = await readAccessResults(client({ failWallet: true }) as any, m, WALLET);
    expect(holder(evaluateAccessInspection(m, failed, WALLET), "connectedWallet").state).toBe("unavailable");
    const ok = await readAccessResults(client({ walletAdmin: true }) as any, m, WALLET);
    expect(holder(evaluateAccessInspection(m, ok, addr(88)), "connectedWallet").state).toBe("unavailable");
  });
});

describe("zeroed timelock module", () => {
  it("is unavailable, never a checked negative holder, and is not read", async () => {
    const m = { ...modules(), timelock: "0x0000000000000000000000000000000000000000" as `0x${string}` };
    const calls: string[] = [];
    const c = {
      readContract: async (a: any) => {
        calls.push(`${a.functionName}:${String(a.args?.[1])}`);
        if (a.functionName === "ADMIN_ROLE") return 0n;
        if (a.functionName === "getTargetFunctionRole") return 0n;
        return [false, 0];
      }
    };
    const reads = await readAccessResults(c as any, m, null);
    const i = evaluateAccessInspection(m, reads, null);
    expect(i.holders.find((h) => h.key === "timelock")).toMatchObject({ address: null, state: "unavailable" });
    expect(i.timelockAdmin).toBe("unavailable");
    expect(calls.some((x) => x.startsWith("hasRole") && x.endsWith("0x0000000000000000000000000000000000000000"))).toBe(false);
  });
});
