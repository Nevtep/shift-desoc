import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi } from "viem";

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
    deploymentConfig: { authorityMode: "governance_managed" },
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

const ONCHAIN_MODULES = {
  accessManager: "0x1000000000000000000000000000000000000003",
  membershipToken: "0x1000000000000000000000000000000000000019",
  governor: "0x1000000000000000000000000000000000000004",
  timelock: "0x1000000000000000000000000000000000000005",
  requestHub: "0x1000000000000000000000000000000000000006",
  draftsManager: "0x1000000000000000000000000000000000000007",
  engagementsManager: "0x1000000000000000000000000000000000000008",
  valuableActionRegistry: "0x1000000000000000000000000000000000000009",
  verifierPowerToken: "0x1000000000000000000000000000000000000010",
  verifierElection: "0x1000000000000000000000000000000000000011",
  verifierManager: "0x1000000000000000000000000000000000000012",
  valuableActionSBT: "0x1000000000000000000000000000000000000013",
  positionManager: "0x1000000000000000000000000000000000000018",
  credentialManager: "0x1000000000000000000000000000000000000028",
  cohortRegistry: "0x1000000000000000000000000000000000000029",
  investmentCohortManager: "0x1000000000000000000000000000000000000030",
  revenueRouter: "0x1000000000000000000000000000000000000016",
  treasuryVault: "0x1111111111111111111111111111111111111111",
  treasuryAdapter: "0x1000000000000000000000000000000000000014",
  communityToken: "0x1000000000000000000000000000000000000015",
  paramController: "0x1000000000000000000000000000000000000002",
  commerceDisputes: "0x1000000000000000000000000000000000000031",
  marketplace: "0x1000000000000000000000000000000000000017",
  housingManager: "0x1000000000000000000000000000000000000032",
  projectFactory: "0x0000000000000000000000000000000000000000"
};

/** On-chain reads of a fully wired community; undefined for any other function. */
function wiringRead(functionName: string): unknown {
  switch (functionName) {
    case "getCommunityModules":
      return ONCHAIN_MODULES;
    case "getRevenuePolicy":
      return [1000, 2000, 1, 5000];
    case "getVerifierParams":
      return [5n, 3n, 20n, true, 1000n, 86400n];
    case "getGovernanceParams":
      return [7200n, 86400n, 21600n];
    default:
      return undefined;
  }
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

  it("rejects legacy mode environment flags", async () => {
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
    ).rejects.toThrow("Legacy deploy modes are disabled in strict staging mode");

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
      simulateContract: vi.fn().mockResolvedValue({}),
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
      simulateContract: vi.fn().mockResolvedValue({}),
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
        key: "FINALIZE_AUTHORITY_MODE",
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
      // The receipt of the earlier registration: the only evidence of which community id this session created.
      getTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [
          {
            topics: encodeEventTopics({
              abi: parseAbi([
                "event CommunityRegistered(uint256 indexed communityId, string name, address indexed creator, uint256 parentCommunityId)"
              ]),
              eventName: "CommunityRegistered",
              args: { communityId: 3n, creator: "0xabc1230000000000000000000000000000000000" }
            }),
            data: encodeAbiParameters([{ type: "string" }, { type: "uint256" }], ["Test", 0n])
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
            return wiringRead(functionName) ?? true;
        }
      }),
      simulateContract: vi.fn().mockResolvedValue({}),
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
        key: "FINALIZE_AUTHORITY_MODE",
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
      simulateContract: vi.fn().mockResolvedValue({}),
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

  it("uses run-scoped addresses for FINALIZE_AUTHORITY_MODE without static lookup", async () => {
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
        const wiring = wiringRead(functionName);
        if (wiring !== undefined) return wiring;
        return true;
      }),
      simulateContract: vi.fn().mockResolvedValue({}),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn()
    } as any;

    const writeContractAsync = vi.fn();
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync,
      connectedAddress: "0xabc1230000000000000000000000000000000000"
    });

    const result = await executor("FINALIZE_AUTHORITY_MODE", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(0);
    expect(writeContractAsync).not.toHaveBeenCalled();
  });

  it("revokes bootstrap coordinator admin during FINALIZE_AUTHORITY_MODE when configured", async () => {
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
        const wiring = wiringRead(functionName);
        if (wiring !== undefined) return wiring;
        return true;
      }),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      simulateContract: vi.fn().mockResolvedValue({}),
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

    const result = await executor("FINALIZE_AUTHORITY_MODE", makeSession(), makeContext());

    expect(result.txHashes ?? []).toHaveLength(3);
    expect(writeContractAsync).toHaveBeenCalledTimes(3);

    const secondCall = writeContractAsync.mock.calls[1]?.[0];
    expect(secondCall?.functionName).toBe("revokeRole");
    expect(secondCall?.args?.[1]).toBe("0x2000000000000000000000000000000000000002");

    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });
});

describe("FINALIZE_AUTHORITY_MODE branches", () => {
  const ACCESS_MANAGER = "0x1000000000000000000000000000000000000003";
  const TIMELOCK = "0x1000000000000000000000000000000000000005";
  const DEPLOYER = "0xabc1230000000000000000000000000000000000";
  const COORDINATOR = "0x2000000000000000000000000000000000000002";

  function sessionFor(mode?: string) {
    const session = makeSession();
    session.deploymentConfig = mode ? { authorityMode: mode } : undefined;
    return session;
  }

  /** holders: lowercase address -> hasRole before revokes; revoked addresses flip to false. */
  function setup(holders: Record<string, boolean>) {
    const state = { ...holders };
    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(5n),
      readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === "ADMIN_ROLE") return 0n;
        if (functionName === "authority") return ACCESS_MANAGER;
        if (functionName === "hasRole") return [Boolean(state[String(args?.[1]).toLowerCase()]), 0];
        const wiring = wiringRead(functionName);
        if (wiring !== undefined) return wiring;
        return true;
      }),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      simulateContract: vi.fn().mockResolvedValue({}),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" })
    } as any;
    const writeContractAsync = vi.fn(async (call: any) => {
      const target = String(call.args[1]).toLowerCase();
      if (call.functionName === "revokeRole") state[target] = false;
      if (call.functionName === "grantRole") state[target] = true;
      return `0x${(writeContractAsync.mock.calls.length).toString(16).padStart(64, "0")}`;
    });
    const executor = createFactoryDeployStepExecutor({
      publicClient,
      writeContractAsync: writeContractAsync as any,
      connectedAddress: DEPLOYER
    });
    return { executor, writeContractAsync };
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = COORDINATOR;
  });

  it("admin_managed: never grants the timelock, keeps deployer ADMIN, revokes only the coordinator", async () => {
    const { executor, writeContractAsync } = setup({
      [DEPLOYER]: true,
      [COORDINATOR]: true,
      [TIMELOCK]: false
    });
    const result = await executor("FINALIZE_AUTHORITY_MODE", sessionFor("admin_managed"), makeContext());
    expect(result.txHashes ?? []).toHaveLength(1);
    const calls = writeContractAsync.mock.calls.map(([c]) => [c.functionName, String(c.args[1]).toLowerCase()]);
    expect(calls).toEqual([["revokeRole", COORDINATOR]]);
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("admin_managed: sends no transactions when the coordinator no longer holds ADMIN", async () => {
    const { executor, writeContractAsync } = setup({ [DEPLOYER]: true });
    const result = await executor("FINALIZE_AUTHORITY_MODE", sessionFor("admin_managed"), makeContext());
    expect(result.txHashes ?? []).toHaveLength(0);
    expect(writeContractAsync).not.toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("admin_managed: fails closed when the deployer lacks ADMIN", async () => {
    const { executor } = setup({ [DEPLOYER]: false });
    await expect(
      executor("FINALIZE_AUTHORITY_MODE", sessionFor("admin_managed"), makeContext())
    ).rejects.toThrow("Admin-managed finalization failed: deployer wallet does not hold admin role.");
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("admin_managed: fails closed when the timelock already holds ADMIN", async () => {
    const { executor, writeContractAsync } = setup({ [DEPLOYER]: true, [TIMELOCK]: true });
    await expect(
      executor("FINALIZE_AUTHORITY_MODE", sessionFor("admin_managed"), makeContext())
    ).rejects.toThrow("Admin-managed finalization failed: timelock holds admin role.");
    expect(writeContractAsync).not.toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("admin_managed: revokes the coordinator persisted with the session even if the env value changed", async () => {
    const CHANGED = "0x3000000000000000000000000000000000000003";
    process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = CHANGED;
    const { executor, writeContractAsync } = setup({
      [DEPLOYER]: true,
      [COORDINATOR]: true,
      [CHANGED]: false,
      [TIMELOCK]: false
    });
    const session = sessionFor("admin_managed");
    session.bootstrapCoordinator = COORDINATOR;
    await executor("FINALIZE_AUTHORITY_MODE", session, makeContext());
    const calls = writeContractAsync.mock.calls.map(([c]) => [c.functionName, String(c.args[1]).toLowerCase()]);
    expect(calls).toEqual([["revokeRole", COORDINATOR]]);
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("governance_managed: grants timelock, revokes coordinator then deployer (same calls as the legacy handoff)", async () => {
    const { executor, writeContractAsync } = setup({
      [DEPLOYER]: true,
      [COORDINATOR]: true,
      [TIMELOCK]: false
    });
    const result = await executor("FINALIZE_AUTHORITY_MODE", sessionFor("governance_managed"), makeContext());
    expect(result.txHashes ?? []).toHaveLength(3);
    const calls = writeContractAsync.mock.calls.map(([c]) => [c.functionName, String(c.args[1]).toLowerCase()]);
    expect(calls).toEqual([
      ["grantRole", TIMELOCK],
      ["revokeRole", COORDINATOR],
      ["revokeRole", DEPLOYER]
    ]);
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });

  it("fails closed without sending transactions when no authority mode was persisted", async () => {
    const { executor, writeContractAsync } = setup({ [DEPLOYER]: true });
    await expect(executor("FINALIZE_AUTHORITY_MODE", sessionFor(undefined), makeContext())).rejects.toThrow(
      "Cannot finalize authority without a selected authority mode."
    );
    expect(writeContractAsync).not.toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  });
});

describe("SHI-169: resume completes the wiring after registerCommunity", () => {
  const DEPLOYER = "0xabc1230000000000000000000000000000000000";
  const ZERO = "0x0000000000000000000000000000000000000000";
  const REGISTER_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const REGISTRY_EVENTS = parseAbi([
    "event CommunityRegistered(uint256 indexed communityId, string name, address indexed creator, uint256 parentCommunityId)",
  ]);
  /** The receipt of this session's registerCommunity: the only evidence of which id it created. */
  const registrationReceipt = (communityId: bigint) => ({
    logs: [
      {
        topics: encodeEventTopics({
          abi: REGISTRY_EVENTS,
          eventName: "CommunityRegistered",
          args: { communityId, creator: DEPLOYER },
        }),
        data: encodeAbiParameters([{ type: "string" }, { type: "uint256" }], ["Test", 0n]),
      },
    ],
  });

  /**
   * Chain whose registerCommunity landed (id 6) and which records each setter the wizard sends.
   * `receipt` is what the node returns for the registration tx; `nextId` is the registry counter.
   */
  function legacyChain(
    done: { verifier: boolean; governance: boolean; revenue: boolean; modules: boolean },
    options: { receipt?: { logs: unknown[] } | "unavailable"; nextId?: bigint } = {},
  ) {
    const state = { ...done };
    const receipt = options.receipt ?? registrationReceipt(6n);
    const publicClient = {
      getTransactionCount: vi.fn().mockResolvedValue(9n),
      getBytecode: vi.fn().mockResolvedValue("0x1234"),
      getTransactionReceipt:
        receipt === "unavailable"
          ? vi.fn().mockRejectedValue(new Error("receipt not found"))
          : vi.fn().mockResolvedValue(receipt),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
          case "nextCommunityId":
            return options.nextId ?? 7n;
          case "getCommunityModules":
            return state.modules ? ONCHAIN_MODULES : { ...ONCHAIN_MODULES, verifierPowerToken: ZERO, governor: ZERO };
          case "getRevenuePolicy":
            return state.revenue ? [1000, 2000, 1, 5000] : [0, 0, 0, 0];
          case "getVerifierParams":
            return state.verifier ? [5n, 3n, 20n, true, 1000n, 86400n] : [0n, 0n, 0n, false, 0n, 0n];
          case "getGovernanceParams":
            return state.governance ? [7200n, 86400n, 21600n] : [0n, 0n, 0n];
          case "ADMIN_ROLE":
            return 0n;
          case "authority":
            return ONCHAIN_MODULES.accessManager;
          default:
            return true;
        }
      }),
      // The registry of the QA run has no bootstrapCommunity: simulation reverts.
      simulateContract: vi.fn().mockRejectedValue(new Error("0xdaa2ea61 reverted")),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any;
    const writeContractAsync = vi.fn(async (call: any) => {
      if (call.functionName === "setVerifierParams") state.verifier = true;
      if (call.functionName === "setGovernanceParams") state.governance = true;
      if (call.functionName === "setRevenuePolicy") state.revenue = true;
      if (call.functionName === "setModuleAddresses") state.modules = true;
      return `0x${(writeContractAsync.mock.calls.length + 1).toString(16).padStart(64, "0")}`;
    });
    return { publicClient, writeContractAsync };
  }

  function failedConfigureSession() {
    const session = makeSession();
    session.communityId = undefined;
    session.steps = [
      { key: "CONFIGURE_ACCESS_PERMISSIONS", status: "failed", expectedTxCount: 9, confirmedTxCount: 4, txHashes: [REGISTER_HASH] }
    ];
    return session;
  }

  async function resumeConfigure(done: Parameters<typeof legacyChain>[0]) {
    const { publicClient, writeContractAsync } = legacyChain(done);
    const executor = createFactoryDeployStepExecutor({ publicClient, writeContractAsync: writeContractAsync as any, connectedAddress: DEPLOYER });
    // Stop right after the wiring: the access/runtime stage is not under test here.
    await executor("CONFIGURE_ACCESS_PERMISSIONS", failedConfigureSession(), makeContext()).catch(() => undefined);
    const sent = writeContractAsync.mock.calls.map(([call]) => call.functionName as string);
    return { sent };
  }

  it("sends the remaining setters after a failed setRevenuePolicy and never registers again", async () => {
    const { sent } = await resumeConfigure({ verifier: true, governance: true, revenue: false, modules: false });

    expect(sent).not.toContain("registerCommunity");
    expect(sent).not.toContain("bootstrapCommunity");
    expect(sent).not.toContain("setVerifierParams");
    expect(sent).not.toContain("setGovernanceParams");
    expect(sent.slice(0, 3)).toEqual(["setEligibilityParams", "setRevenuePolicy", "setModuleAddresses"]);
  });

  it("never writes against the global counter when this session's registration receipt is unavailable", async () => {
    // Another community registered after ours (counter is 8, ours is 6): `nextCommunityId - 1` would be 7.
    const { publicClient, writeContractAsync } = legacyChain(
      { verifier: true, governance: true, revenue: false, modules: false },
      { receipt: "unavailable", nextId: 8n },
    );
    const executor = createFactoryDeployStepExecutor({ publicClient, writeContractAsync: writeContractAsync as any, connectedAddress: DEPLOYER });

    await expect(executor("CONFIGURE_ACCESS_PERMISSIONS", failedConfigureSession(), makeContext())).rejects.toThrow(
      /registration receipt/i,
    );
    expect(writeContractAsync).not.toHaveBeenCalled();
  });

  it("never writes when the registration receipt carries no CommunityRegistered event", async () => {
    const { publicClient, writeContractAsync } = legacyChain(
      { verifier: true, governance: true, revenue: false, modules: false },
      { receipt: { logs: [] }, nextId: 8n },
    );
    const executor = createFactoryDeployStepExecutor({ publicClient, writeContractAsync: writeContractAsync as any, connectedAddress: DEPLOYER });

    await expect(executor("CONFIGURE_ACCESS_PERMISSIONS", failedConfigureSession(), makeContext())).rejects.toThrow(
      /registration receipt/i,
    );
    expect(writeContractAsync).not.toHaveBeenCalled();
  });

  it("sends only setModuleAddresses when the revenue policy is already set", async () => {
    const { sent } = await resumeConfigure({ verifier: true, governance: true, revenue: true, modules: false });

    expect(sent[0]).toBe("setModuleAddresses");
    expect(sent).not.toContain("setRevenuePolicy");
  });

  it("sends no wiring transaction when the chain already shows a complete wiring", async () => {
    const { sent } = await resumeConfigure({ verifier: true, governance: true, revenue: true, modules: true });

    for (const name of ["registerCommunity", "setVerifierParams", "setGovernanceParams", "setEligibilityParams", "setRevenuePolicy", "setModuleAddresses"]) {
      expect(sent).not.toContain(name);
    }
  });

  describe.each(["admin_managed", "governance_managed"])("FINALIZE_AUTHORITY_MODE (%s) with incomplete wiring", (mode) => {
    function finalizeWith(done: Parameters<typeof legacyChain>[0]) {
      process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";
      const { publicClient, writeContractAsync } = legacyChain(done);
      const session = makeSession();
      session.communityId = 6;
      session.deploymentConfig = { authorityMode: mode };
      const executor = createFactoryDeployStepExecutor({ publicClient, writeContractAsync: writeContractAsync as any, connectedAddress: DEPLOYER });
      return { run: () => executor("FINALIZE_AUTHORITY_MODE", session, makeContext()), writeContractAsync };
    }

    it("sends no revokeRole and names the missing modules and revenue policy", async () => {
      const { run, writeContractAsync } = finalizeWith({ verifier: true, governance: true, revenue: false, modules: false });

      await expect(run()).rejects.toThrow(/modules not registered \(.*verifierPowerToken.*\).*revenue policy not set/);
      expect(writeContractAsync).not.toHaveBeenCalled();
    });

    it("names only the revenue policy when the modules are registered", async () => {
      const { run, writeContractAsync } = finalizeWith({ verifier: true, governance: true, revenue: false, modules: true });

      await expect(run()).rejects.toThrow("revenue policy not set");
      expect(writeContractAsync).not.toHaveBeenCalled();
    });
  });
});
