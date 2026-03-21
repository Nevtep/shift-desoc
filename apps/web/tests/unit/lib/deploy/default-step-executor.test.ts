import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultUserSignedStepExecutor } from "../../../../lib/deploy/default-step-executor";

const getContractAddressMock = vi.fn();

vi.mock("../../../../lib/contracts", () => ({
  getContractAddress: (...args: unknown[]) => getContractAddressMock(...args)
}));

function makeSession() {
  return {
    sessionId: "session-1",
    deployerAddress: "0xabc1230000000000000000000000000000000000",
    chainId: 84532,
    status: "in-progress",
    targetType: "registered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    communityId: 77,
    deploymentAddresses: {
      communityRegistry: "0x1000000000000000000000000000000000000001",
      paramController: "0x1000000000000000000000000000000000000002",
      accessManager: "0x1000000000000000000000000000000000000003",
      governor: "0x1000000000000000000000000000000000000004",
      timelock: "0x1000000000000000000000000000000000000005",
      requestHub: "0x1000000000000000000000000000000000000006",
      draftsManager: "0x1000000000000000000000000000000000000007",
      engagements: "0x1000000000000000000000000000000000000008",
      valuableActionRegistry: "0x1000000000000000000000000000000000000009",
      verifierPowerToken: "0x1000000000000000000000000000000000000010",
      verifierElection: "0x1000000000000000000000000000000000000011",
      verifierManager: "0x1000000000000000000000000000000000000012",
      valuableActionSBT: "0x1000000000000000000000000000000000000013",
      treasuryAdapter: "0x1000000000000000000000000000000000000014",
      communityToken: "0x1000000000000000000000000000000000000015",
      revenueRouter: "0x1000000000000000000000000000000000000016",
      marketplace: "0x1000000000000000000000000000000000000017"
    },
    steps: []
  } as any;
}

function makeContext() {
  return {
    config: {
      communityName: "Test",
      communityDescription: "Test",
      communityMetadataUri: "",
      treasuryVault: "0x1111111111111111111111111111111111111111",
      treasuryStableToken: "0x2222222222222222222222222222222222222222",
      supportedTokensCsv: "0x2222222222222222222222222222222222222222"
    },
    chainId: 84532,
    preflight: {
      sharedInfra: {
        accessManager: { address: "0x1000000000000000000000000000000000000003", hasCode: true, abiProbePassed: true },
        paramController: { address: "0x1000000000000000000000000000000000000002", hasCode: true, abiProbePassed: true },
        communityRegistry: { address: "0x1000000000000000000000000000000000000001", hasCode: true, abiProbePassed: true }
      }
    }
  } as any;
}

describe("default-step-executor strict staging guards", () => {
  beforeEach(() => {
    getContractAddressMock.mockReset();
  });

  it("rejects unsupported chain ids", async () => {
    const executor = createDefaultUserSignedStepExecutor({
      publicClient: {} as any,
      writeContractAsync: vi.fn()
    });

    await expect(
      executor("PRECHECKS", {} as any, {
        config: {} as any,
        chainId: 1,
        preflight: {} as any
      })
    ).rejects.toThrow("Strict staging mode only supports Base Sepolia");
  });

  it("rejects legacy mode environment flags", async () => {
    process.env.NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE = "1";

    const executor = createDefaultUserSignedStepExecutor({
      publicClient: {} as any,
      writeContractAsync: vi.fn()
    });

    await expect(
      executor("PRECHECKS", {} as any, {
        config: {} as any,
        chainId: 84532,
        preflight: {} as any
      })
    ).rejects.toThrow("Legacy deploy modes are disabled in strict staging mode");

    delete process.env.NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE;
  });

  it("uses run-scoped addresses for CONFIGURE_ACCESS_PERMISSIONS without static lookup", async () => {
    getContractAddressMock.mockImplementation(() => {
      throw new Error("static address lookup should not be used");
    });

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      getBytecode: vi.fn().mockResolvedValue("0x"),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "ADMIN_ROLE":
            return 0n;
          case "hasRole":
            return [true, 0];
          case "communityInitialized":
            return true;
          case "valuableActionSBT":
            return "0x1000000000000000000000000000000000000013";
          case "isIssuanceModule":
            return true;
          case "founderWhitelist":
            return true;
          case "communityTreasuries":
            return "0x1111111111111111111111111111111111111111";
          case "supportedTokens":
            return true;
          case "tokenAllowed":
            return true;
          case "capBps":
            return 1000n;
          case "destinationAllowed":
            return true;
          case "communityActive":
            return true;
          case "communityTokens":
            return "0x1000000000000000000000000000000000000015";
          default:
            return true;
        }
      }),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn()
    } as any;

    const writeContractAsync = vi.fn();
    const executor = createDefaultUserSignedStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("CONFIGURE_ACCESS_PERMISSIONS", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(0);
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(getContractAddressMock).not.toHaveBeenCalled();
  });

  it("uses run-scoped addresses for HANDOFF_ADMIN_TO_TIMELOCK without static lookup", async () => {
    getContractAddressMock.mockImplementation(() => {
      throw new Error("static address lookup should not be used");
    });

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "ADMIN_ROLE") return 0n;
        if (functionName === "hasRole") {
          const account = args?.[1] as string;
          if (account.toLowerCase() === "0x1000000000000000000000000000000000000005") return [true, 0];
          return [false, 0];
        }
        return true;
      }),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn()
    } as any;

    const writeContractAsync = vi.fn();
    const executor = createDefaultUserSignedStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("HANDOFF_ADMIN_TO_TIMELOCK", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(0);
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(getContractAddressMock).not.toHaveBeenCalled();
  });

  it("revokes bootstrap coordinator admin during HANDOFF_ADMIN_TO_TIMELOCK when configured", async () => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";

    let timelockHasRoleChecks = 0;
    let deployerHasRoleChecks = 0;
    let coordinatorHasRoleChecks = 0;

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(5n),
      readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "ADMIN_ROLE") return 0n;
        if (functionName === "hasRole") {
          const account = String(args?.[1] ?? "").toLowerCase();
          if (account === "0x1000000000000000000000000000000000000005") {
            timelockHasRoleChecks += 1;
            return [timelockHasRoleChecks > 1, 0]; // false before grant, true after
          }
          if (account === "0xabc1230000000000000000000000000000000000") {
            deployerHasRoleChecks += 1;
            return [deployerHasRoleChecks === 1, 0]; // true before revoke, false after
          }
          if (account === "0x2000000000000000000000000000000000000002") {
            coordinatorHasRoleChecks += 1;
            return [coordinatorHasRoleChecks === 1, 0]; // true before revoke, false after
          }
          return [false, 0];
        }
        return true;
      }),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" })
    } as any;

    const writeContractAsync = vi.fn()
      .mockResolvedValueOnce("0xaaa") // grant timelock admin
      .mockResolvedValueOnce("0xbbb") // revoke deployer
      .mockResolvedValueOnce("0xccc"); // revoke coordinator

    const executor = createDefaultUserSignedStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("HANDOFF_ADMIN_TO_TIMELOCK", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(3);
    expect(writeContractAsync).toHaveBeenCalledTimes(3);

    const thirdCall = writeContractAsync.mock.calls[2]?.[0];
    expect(thirdCall?.functionName).toBe("revokeRole");
    expect(thirdCall?.args?.[1]).toBe("0x2000000000000000000000000000000000000002");

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });
});
