import { describe, expect, it, vi } from "vitest";

import { readAuthorityAdminHolders } from "../../../../lib/deploy/onchain";

const ACCESS_MANAGER = "0x1000000000000000000000000000000000000003" as const;
const TIMELOCK = "0x1000000000000000000000000000000000000005" as const;
const DEPLOYER = "0xabc1230000000000000000000000000000000000" as const;
const COORDINATOR = "0x2000000000000000000000000000000000000002" as const;

function client(holders: Record<string, boolean>) {
  return {
    readContract: vi.fn(async ({ functionName, args }: any) => {
      if (functionName !== "hasRole") throw new Error("unexpected " + functionName);
      expect(args[0]).toBe(0n);
      return [Boolean(holders[String(args[1]).toLowerCase()]), 0];
    })
  } as any;
}

describe("readAuthorityAdminHolders", () => {
  it("reads ADMIN_ROLE membership for deployer, timelock and coordinator", async () => {
    const result = await readAuthorityAdminHolders(
      client({ [DEPLOYER]: true }),
      ACCESS_MANAGER,
      { deployer: DEPLOYER, timelock: TIMELOCK, bootstrapCoordinator: COORDINATOR }
    );
    expect(result).toEqual({ deployer: true, timelock: false, bootstrapCoordinator: false });
  });

  it("omits the coordinator when none is configured", async () => {
    const result = await readAuthorityAdminHolders(client({}), ACCESS_MANAGER, {
      deployer: DEPLOYER,
      timelock: TIMELOCK
    });
    expect(result.bootstrapCoordinator).toBeUndefined();
  });
});
