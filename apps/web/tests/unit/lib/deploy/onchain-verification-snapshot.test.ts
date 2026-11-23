import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readVerificationSnapshot } from "../../../../lib/deploy/onchain";

const ZERO = "0x0000000000000000000000000000000000000000";
const REGISTRY = "0x1000000000000000000000000000000000000001";
const ACCESS_MANAGER = "0x1000000000000000000000000000000000000003";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;

const FULL_MODULES = {
  requestHub: addr(0x11),
  engagementsManager: addr(0x12),
  positionManager: addr(0x13),
  credentialManager: addr(0x14),
  investmentCohortManager: addr(0x15),
  valuableActionRegistry: addr(0x16),
  verifierPowerToken: addr(0x17),
  revenueRouter: addr(0x18),
  marketplace: addr(0x19)
};

const ZERO_MODULES = Object.fromEntries(Object.keys(FULL_MODULES).map((key) => [key, ZERO]));

function client(modules: Record<string, string>) {
  return {
    readContract: vi.fn(async ({ address, functionName }: any) => {
      if (functionName === "getCommunityModules") return modules;
      if (functionName === "authority") return ACCESS_MANAGER;
      if (functionName === "hasRole") return [true, 0];
      if (functionName === "communityInitialized" || functionName === "communityActive") return true;
      if (functionName === "communityTreasuries") return addr(0x99);
      throw new Error(`unexpected ${functionName} on ${address}`);
    })
  } as any;
}

function callsToZero(publicClient: any) {
  return publicClient.readContract.mock.calls.filter(([call]: any[]) => call.address === ZERO);
}

describe("readVerificationSnapshot registry module checks", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_COMMUNITY_REGISTRY", REGISTRY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects naming the module and community id when the registry has no modules, without calling the zero address", async () => {
    const publicClient = client(ZERO_MODULES);

    await expect(readVerificationSnapshot(publicClient, 84532, 6)).rejects.toThrow(
      "Community 6 has no module registered for verifierPowerToken: the registry wiring step did not complete"
    );
    expect(callsToZero(publicClient)).toHaveLength(0);
  });

  it("rejects when only verifierPowerToken is unregistered", async () => {
    const publicClient = client({ ...FULL_MODULES, verifierPowerToken: ZERO });

    await expect(readVerificationSnapshot(publicClient, 84532, 7)).rejects.toThrow(
      "Community 7 has no module registered for verifierPowerToken"
    );
    expect(callsToZero(publicClient)).toHaveLength(0);
  });

  it.each(["requestHub", "valuableActionRegistry"] as const)("rejects when %s is unregistered", async (name) => {
    const publicClient = client({ ...FULL_MODULES, [name]: ZERO });

    await expect(readVerificationSnapshot(publicClient, 84532, 8)).rejects.toThrow(
      `Community 8 has no module registered for ${name}`
    );
    expect(callsToZero(publicClient)).toHaveLength(0);
  });

  it("still falls back to run-scoped addresses for modules the registry omits", async () => {
    const publicClient = client({ ...FULL_MODULES, marketplace: ZERO });

    const snapshot = await readVerificationSnapshot(publicClient, 84532, 9, { marketplace: addr(0x77) } as any);

    expect(snapshot.communityId).toBe(9);
    expect(snapshot.vptInitialized).toBe(true);
  });

  it("reads a fully wired community", async () => {
    const snapshot = await readVerificationSnapshot(client(FULL_MODULES), 84532, 10);

    expect(snapshot.vptInitialized).toBe(true);
    expect(snapshot.marketplaceActive).toBe(true);
  });
});
