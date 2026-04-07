import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFactoryDeployStepExecutor } from "../../../../lib/deploy/factory-step-executor";

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
      membershipToken: "0x1000000000000000000000000000000000000019",
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
      positionManager: "0x1000000000000000000000000000000000000018",
      credentialManager: "0x1000000000000000000000000000000000000028",
      cohortRegistry: "0x1000000000000000000000000000000000000029",
      investmentCohortManager: "0x1000000000000000000000000000000000000030",
      treasuryAdapter: "0x1000000000000000000000000000000000000014",
      communityToken: "0x1000000000000000000000000000000000000015",
      revenueRouter: "0x1000000000000000000000000000000000000016",
      commerceDisputes: "0x1000000000000000000000000000000000000031",
      marketplace: "0x1000000000000000000000000000000000000017",
      housingManager: "0x1000000000000000000000000000000000000032"
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
        paramController: { address: "0x1000000000000000000000000000000000000002", hasCode: true, abiProbePassed: true },
        communityRegistry: { address: "0x1000000000000000000000000000000000000001", hasCode: true, abiProbePassed: true },
        governanceLayerFactory: { address: "0x1000000000000000000000000000000000000020", hasCode: true, abiProbePassed: true },
        verificationLayerFactory: { address: "0x1000000000000000000000000000000000000021", hasCode: true, abiProbePassed: true },
        economicLayerFactory: { address: "0x1000000000000000000000000000000000000022", hasCode: true, abiProbePassed: true },
        commerceLayerFactory: { address: "0x1000000000000000000000000000000000000023", hasCode: true, abiProbePassed: true },
        coordinationLayerFactory: { address: "0x1000000000000000000000000000000000000024", hasCode: true, abiProbePassed: true }
      }
    }
  } as any;
}

describe("factory-step-executor strict staging guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unsupported chain ids", async () => {
    const executor = createFactoryDeployStepExecutor({
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

  it("rejects compatibility mode environment flags", async () => {
    process.env.NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE = "1";

    const executor = createFactoryDeployStepExecutor({
      publicClient: {} as any,
      writeContractAsync: vi.fn()
    });

    await expect(
      executor("PRECHECKS", {} as any, {
        config: {} as any,
        chainId: 84532,
        preflight: {} as any
      })
    ).rejects.toThrow("Compatibility deploy overrides are not supported in strict staging mode");

    delete process.env.NEXT_PUBLIC_SHIFT_ENABLE_MIXED_MODE;
  });

  it("uses run-scoped addresses for CONFIGURE_ACCESS_PERMISSIONS without static lookup", async () => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";
    let nextCommunityId = 1n;

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "nextCommunityId": {
            const value = nextCommunityId;
            nextCommunityId += 1n;
            return value;
          }
          case "ADMIN_ROLE":
            return 0n;
          case "authority":
            return "0x1000000000000000000000000000000000000003";
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
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;

    const writeContractAsync = vi.fn().mockResolvedValue("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      deployContractAsync: vi.fn(),
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("CONFIGURE_ACCESS_PERMISSIONS", makeSession(), makeContext());

    expect(result.communityId).toBe(1);
    expect(result.txHashes?.length ?? 0).toBeGreaterThan(0);
    expect(writeContractAsync).toHaveBeenCalled();

    const bootstrapCallArgs = writeContractAsync.mock.calls.find(
      ([args]) => args?.functionName === "bootstrapCommunity"
    )?.[0];
    const bootstrapAbiEntry = (bootstrapCallArgs?.abi ?? []).find(
      (entry: any) => entry?.type === "function" && entry?.name === "bootstrapCommunity"
    );
    const modulesInput = bootstrapAbiEntry?.inputs?.[5];
    expect(modulesInput?.components?.length).toBe(26);

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("fails fast when ParamController registry wiring is missing", async () => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "registrySet":
            return false;
          case "nextCommunityId":
            return 1n;
          case "ADMIN_ROLE":
            return 0n;
          case "authority":
            return "0x1000000000000000000000000000000000000003";
          case "hasRole":
            return [true, 0];
          default:
            return true;
        }
      }),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;

    const writeContractAsync = vi.fn();
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      deployContractAsync: vi.fn(),
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    await expect(executor("CONFIGURE_ACCESS_PERMISSIONS", makeSession(), makeContext())).rejects.toThrow(
      "ParamController is not wired to any CommunityRegistry"
    );
    expect(writeContractAsync).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("falls back to static gas when bootstrapAccessAndRuntime estimation returns AccessManagedUnauthorized", async () => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";
    let nextCommunityId = 1n;

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "nextCommunityId": {
            const value = nextCommunityId;
            nextCommunityId += 1n;
            return value;
          }
          case "ADMIN_ROLE":
            return 0n;
          case "authority":
            return "0x1000000000000000000000000000000000000003";
          case "hasRole":
            return [true, 0];
          default:
            return true;
        }
      }),
      estimateContractGas: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "bootstrapAccessAndRuntime") {
          throw new Error("AccessManagedUnauthorized(0xabc123)");
        }
        return 21000n;
      }),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;

    const writeContractAsync = vi
      .fn()
      .mockResolvedValue("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      deployContractAsync: vi.fn(),
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("CONFIGURE_ACCESS_PERMISSIONS", makeSession(), makeContext());

    expect(result.communityId).toBe(1);
    expect(result.txHashes?.length ?? 0).toBe(2);
    expect(writeContractAsync).toHaveBeenCalled();

    const bootstrapCall = writeContractAsync.mock.calls.find(
      ([args]) => args?.functionName === "bootstrapAccessAndRuntime"
    )?.[0];
    expect(bootstrapCall).toBeTruthy();
    expect(bootstrapCall.gas).toBe(1800000n);

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("resumes CONFIGURE_ACCESS_PERMISSIONS from prior bootstrap tx without re-running bootstrapCommunity", async () => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";

    const resumedSession = makeSession();
    resumedSession.communityId = undefined;
    resumedSession.steps = [
      {
        key: "PRECHECKS",
        status: "succeeded",
        expectedTxCount: 0,
        confirmedTxCount: 0,
        txHashes: []
      },
      {
        key: "DEPLOY_STACK",
        status: "succeeded",
        expectedTxCount: 7,
        confirmedTxCount: 7,
        txHashes: [
          "0x1111111111111111111111111111111111111111111111111111111111111111"
        ]
      },
      {
        key: "CONFIGURE_ACCESS_PERMISSIONS",
        status: "failed",
        expectedTxCount: 2,
        confirmedTxCount: 1,
        txHashes: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ]
      },
      {
        key: "HANDOFF_ADMIN_TO_TIMELOCK",
        status: "pending",
        expectedTxCount: 3,
        confirmedTxCount: 0,
        txHashes: []
      },
      {
        key: "VERIFY_DEPLOYMENT",
        status: "pending",
        expectedTxCount: 0,
        confirmedTxCount: 0,
        txHashes: []
      }
    ];

    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      getTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          {
            data: "0x",
            topics: ["0xdeadbeef"]
          }
        ]
      }),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "nextCommunityId":
            return 4n;
          case "ADMIN_ROLE":
            return 0n;
          case "authority":
            return "0x1000000000000000000000000000000000000003";
          case "hasRole":
            return [true, 0];
          default:
            return true;
        }
      }),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;

    const writeContractAsync = vi
      .fn()
      .mockResolvedValue("0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");

    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      deployContractAsync: vi.fn(),
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("CONFIGURE_ACCESS_PERMISSIONS", resumedSession, makeContext());

    expect(result.communityId).toBe(3);

    const calledFunctionNames = writeContractAsync.mock.calls.map(([args]) => args?.functionName);
    expect(calledFunctionNames.includes("bootstrapCommunity")).toBe(false);
    expect(calledFunctionNames.includes("bootstrapAccessAndRuntime")).toBe(true);

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("resumes DEPLOY_STACK from prior layer tx without redeploying recovered governance layer", async () => {
    const resumedSession = makeSession();
    delete resumedSession.deploymentAddresses.membershipToken;
    delete resumedSession.deploymentAddresses.timelock;
    delete resumedSession.deploymentAddresses.governor;
    resumedSession.steps = [
      {
        key: "PRECHECKS",
        status: "succeeded",
        expectedTxCount: 0,
        confirmedTxCount: 0,
        txHashes: []
      },
      {
        key: "DEPLOY_STACK",
        status: "failed",
        expectedTxCount: 7,
        confirmedTxCount: 3,
        txHashes: [
          "0x1111111111111111111111111111111111111111111111111111111111111111"
        ]
      },
      {
        key: "CONFIGURE_ACCESS_PERMISSIONS",
        status: "pending",
        expectedTxCount: 2,
        confirmedTxCount: 0,
        txHashes: []
      },
      {
        key: "HANDOFF_ADMIN_TO_TIMELOCK",
        status: "pending",
        expectedTxCount: 3,
        confirmedTxCount: 0,
        txHashes: []
      },
      {
        key: "VERIFY_DEPLOYMENT",
        status: "pending",
        expectedTxCount: 0,
        confirmedTxCount: 0,
        txHashes: []
      }
    ];

    const governanceFactoryAddress = "0x1000000000000000000000000000000000000020";

    const publicClient = {
      getTransaction: vi.fn().mockResolvedValue({ to: governanceFactoryAddress }),
      getTransactionReceipt: vi.fn().mockResolvedValue({ contractAddress: null }),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      readContract: vi.fn(async ({ functionName, address }: { functionName: string; address: string }) => {
        if (functionName === "ADMIN_ROLE") return 0n;
        if (functionName === "authority") return "0x1000000000000000000000000000000000000003";
        if (functionName === "nextCommunityId") return 5n;
        if (functionName === "lastDeploymentByCaller" && address.toLowerCase() === governanceFactoryAddress.toLowerCase()) {
          return {
            membershipToken: "0x3000000000000000000000000000000000000001",
            timelock: "0x3000000000000000000000000000000000000002",
            governor: "0x3000000000000000000000000000000000000003",
            countingMultiChoice: "0x3000000000000000000000000000000000000004"
          };
        }
        if (functionName === "lastDeploymentByCaller") {
          return {
            verifierPowerToken: "0x3000000000000000000000000000000000000010",
            verifierElection: "0x3000000000000000000000000000000000000011",
            verifierManager: "0x3000000000000000000000000000000000000012",
            valuableActionRegistry: "0x3000000000000000000000000000000000000013",
            valuableActionSBT: "0x3000000000000000000000000000000000000014",
            engagements: "0x3000000000000000000000000000000000000015",
            positionManager: "0x3000000000000000000000000000000000000016",
            credentialManager: "0x3000000000000000000000000000000000000017"
          };
        }
        return true;
      }),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;

    const writeContractAsync = vi.fn();

    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      deployContractAsync: vi.fn(),
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("DEPLOY_STACK", resumedSession, makeContext());

    expect(result.txHashes?.length ?? 0).toBeGreaterThan(0);

    const calledFunctionNames = writeContractAsync.mock.calls.map(([args]) => args?.functionName);
    expect(calledFunctionNames.includes("deployLayer")).toBe(false);
  });

  it("uses run-scoped addresses for HANDOFF_ADMIN_TO_TIMELOCK without static lookup", async () => {
    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(1n),
      readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "ADMIN_ROLE") return 0n;
        if (functionName === "authority") return "0x1000000000000000000000000000000000000003";
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
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("HANDOFF_ADMIN_TO_TIMELOCK", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(0);
    expect(writeContractAsync).not.toHaveBeenCalled();
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
        if (functionName === "authority") return "0x1000000000000000000000000000000000000003";
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
      .mockResolvedValueOnce("0xbbb") // revoke coordinator
      .mockResolvedValueOnce("0xccc"); // revoke deployer

    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("HANDOFF_ADMIN_TO_TIMELOCK", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(3);
    expect(writeContractAsync).toHaveBeenCalledTimes(3);

    const secondCall = writeContractAsync.mock.calls[1]?.[0];
    expect(secondCall?.functionName).toBe("revokeRole");
    expect(secondCall?.args?.[1]).toBe("0x2000000000000000000000000000000000000002");

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });
});
