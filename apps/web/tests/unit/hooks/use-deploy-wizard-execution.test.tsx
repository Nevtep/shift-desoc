import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useDeployWizard } from "../../../hooks/useDeployWizard";
import { applyAuthorityModeToSteps, createInitialSession, transitionStep } from "../../../lib/deploy/wizard-machine";
import { mockWagmiHooks, TestWrapper } from "../utils";

function validConfig() {
  return {
    communityName: "Shift Wizard Deployment",
    communityDescription: "Deployment from manager wizard",
    communityMetadataUri: "",
    treasuryVault: "0x1111111111111111111111111111111111111111",
    treasuryStableToken: "0x2222222222222222222222222222222222222222",
    supportedTokensCsv: "0x2222222222222222222222222222222222222222",
    authorityMode: "governance_managed" as const
  };
}

describe("useDeployWizard execution flow", () => {
  it("executes step sequence and completes when verification passes", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step) => {
            if (step === "DEPLOY_STACK") {
              return {
                txHashes: ["0x1000000000000000000000000000000000000000000000000000000000000001"],
                communityId: 77
              };
            }
            if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
              return {
                txHashes: ["0x2000000000000000000000000000000000000000000000000000000000000002"]
              };
            }
            if (step === "FINALIZE_AUTHORITY_MODE") {
              return {
                txHashes: ["0x3000000000000000000000000000000000000000000000000000000000000003"]
              };
            }
            return {};
          },
          readVerificationSnapshot: async () => ({
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true,
            authority: { deployer: false, timelock: true, bootstrapCoordinator: false }
          })
        }),
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await result.current.run(validConfig());
    });

    expect(result.current.session?.communityId).toBe(77);
    expect(result.current.session?.status).toBe("completed");
    expect(result.current.session?.deploymentConfig).toEqual(validConfig());
    expect(result.current.session?.steps.every((step) => step.status === "succeeded")).toBe(true);
  });

  it("stops and records failure when a step throws", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step) => {
            if (step === "DEPLOY_STACK") {
              return {
                txHashes: ["0x1000000000000000000000000000000000000000000000000000000000000001"],
                communityId: 77
              };
            }
            if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
              throw new Error("wire failed");
            }
            return {};
          }
        }),
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await result.current.run(validConfig());
    });

    expect(result.current.session?.status).toBe("failed");
    expect(result.current.session?.lastError?.stepKey).toBe("CONFIGURE_ACCESS_PERMISSIONS");
    expect(result.current.error).toBe("wire failed");
  });

  it("starts from PRECHECKS on a new Start deploy after prior failed run", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const executedSteps: string[] = [];
    let verificationCallCount = 0;

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step) => {
            executedSteps.push(step);
            if (step === "DEPLOY_STACK") {
              return {
                txHashes: ["0x1000000000000000000000000000000000000000000000000000000000000001"],
                communityId: 77
              };
            }
            if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
              return {
                txHashes: ["0x2000000000000000000000000000000000000000000000000000000000000002"]
              };
            }
            if (step === "FINALIZE_AUTHORITY_MODE") {
              return {
                txHashes: ["0x3000000000000000000000000000000000000000000000000000000000000003"]
              };
            }
            return {};
          },
          readVerificationSnapshot: async () => {
            verificationCallCount += 1;
            return {
              modules: { valuableActionRegistryMatches: verificationCallCount > 1 },
              vptInitialized: verificationCallCount > 1,
              roles: {
                rrPositionManager: verificationCallCount > 1,
                verifierManagerCallerEngagements: verificationCallCount > 1,
                rrDistributor: verificationCallCount > 1,
                commerceDisputesCaller: verificationCallCount > 1,
                cohortRevenueRouter: verificationCallCount > 1,
                housingMarketplaceCaller: verificationCallCount > 1,
                cohortInvestmentRecorder: verificationCallCount > 1,
                vaIssuerRequestHub: verificationCallCount > 1,
                vaIssuerPositionManager: verificationCallCount > 1,
                vaIssuerInvestmentCohortManager: verificationCallCount > 1,
                vaIssuerCredentialManager: verificationCallCount > 1,
                membershipMinterEngagements: verificationCallCount > 1,
                vaSbtManagerRegistry: verificationCallCount > 1
              },
              marketplaceActive: verificationCallCount > 1,
              revenueTreasurySet: verificationCallCount > 1,
              authority: { deployer: false, timelock: verificationCallCount > 1, bootstrapCoordinator: false }
            };
          }
        }),
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await result.current.run(validConfig());
    });
    expect(result.current.session?.status).toBe("failed");

    const firstRunLength = executedSteps.length;

    await act(async () => {
      await result.current.run(validConfig());
    });

    expect(executedSteps[firstRunLength]).toBe("PRECHECKS");
    expect(result.current.session?.status).toBe("completed");
  });

  it("reports incomplete registry wiring at verification and keeps the session resumable", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });
    const message =
      "Community 6 has no module registered for verifierPowerToken: the registry wiring step did not complete";

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step) => (step === "DEPLOY_STACK" ? { communityId: 6 } : {}),
          readVerificationSnapshot: async () => {
            throw new Error(message);
          }
        }),
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await result.current.run(validConfig());
    });

    const verifyStep = result.current.session?.steps.find((step) => step.key === "VERIFY_DEPLOYMENT");
    expect(result.current.session?.status).toBe("failed");
    expect(verifyStep?.status).toBe("failed");
    expect(verifyStep?.failureReason).toBe(message);
    expect(verifyStep?.nextActionHint).toBe("Fix the issue and use Resume deploy.");
    expect(result.current.error).toBe(message);
  });

  it("ignores incompatible legacy resume sessions and starts fresh", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const executedSteps: string[] = [];

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step) => {
            executedSteps.push(step);
            if (step === "DEPLOY_STACK") {
              return {
                txHashes: ["0x1000000000000000000000000000000000000000000000000000000000000001"],
                communityId: 88
              };
            }
            if (step === "CONFIGURE_ACCESS_PERMISSIONS") {
              return {
                txHashes: ["0x2000000000000000000000000000000000000000000000000000000000000002"]
              };
            }
            if (step === "FINALIZE_AUTHORITY_MODE") {
              return {
                txHashes: ["0x3000000000000000000000000000000000000000000000000000000000000003"]
              };
            }
            return {};
          },
          readVerificationSnapshot: async () => ({
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true,
            authority: { deployer: false, timelock: true, bootstrapCoordinator: false }
          })
        }),
      { wrapper: TestWrapper }
    );

    const incompatibleLegacySession = {
      sessionId: "legacy-session",
      deployerAddress: "0xabc1230000000000000000000000000000000000",
      chainId: 84532,
      targetType: "registered" as const,
      status: "failed" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        {
          key: "PRECHECKS" as const,
          name: "Preflight",
          purpose: "",
          status: "succeeded" as const,
          expectedTxCount: 0,
          confirmedTxCount: 0,
          txHashes: [] as `0x${string}`[]
        },
        {
          key: "DEPLOY_STACK" as const,
          name: "Deploy Community Stack",
          purpose: "",
          status: "failed" as const,
          expectedTxCount: 8,
          confirmedTxCount: 0,
          txHashes: [] as `0x${string}`[]
        }
      ],
      communityId: 88
    };

    await act(async () => {
      await result.current.run(validConfig(), incompatibleLegacySession as any);
    });

    expect(executedSteps[0]).toBe("PRECHECKS");
    expect(result.current.session?.status).toBe("completed");
  });

  it("resumes FINALIZE_AUTHORITY_MODE with the persisted mode, ignoring a different mode in the form", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });

    const seen: Array<{ step: string; mode?: string; expected?: number }> = [];
    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step, session) => {
            seen.push({
              step,
              mode: session.deploymentConfig?.authorityMode,
              expected: session.steps.find((s) => s.key === "FINALIZE_AUTHORITY_MODE")?.expectedTxCount
            });
            return {};
          },
          readVerificationSnapshot: async () => ({
            communityId: 77,
            modules: { valuableActionRegistryMatches: true },
            vptInitialized: true,
            roles: {
              rrPositionManager: true,
              verifierManagerCallerEngagements: true,
              rrDistributor: true,
              commerceDisputesCaller: true,
              cohortRevenueRouter: true,
              housingMarketplaceCaller: true,
              cohortInvestmentRecorder: true,
              vaIssuerRequestHub: true,
              vaIssuerPositionManager: true,
              vaIssuerInvestmentCohortManager: true,
              vaIssuerCredentialManager: true,
              membershipMinterEngagements: true,
              vaSbtManagerRegistry: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true,
            authority: { deployer: true, timelock: false, bootstrapCoordinator: false }
          })
        }),
      { wrapper: TestWrapper }
    );

    // Interrupted after DEPLOY_STACK + CONFIGURE for an admin_managed run.
    const interrupted = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    interrupted.communityId = 77;
    interrupted.status = "failed";
    interrupted.deploymentConfig = { ...validConfig(), authorityMode: "admin_managed" };
    interrupted.steps = ["PRECHECKS", "DEPLOY_STACK", "CONFIGURE_ACCESS_PERMISSIONS"].reduce(
      (steps, key) => transitionStep(steps, key as any, "succeeded"),
      applyAuthorityModeToSteps(interrupted.steps, "admin_managed")
    );

    await act(async () => {
      // The form now says governance_managed; the persisted mode must win.
      await result.current.run({ ...validConfig(), authorityMode: "governance_managed" }, interrupted);
    });

    const finalize = seen.find((entry) => entry.step === "FINALIZE_AUTHORITY_MODE");
    expect(finalize).toEqual({ step: "FINALIZE_AUTHORITY_MODE", mode: "admin_managed", expected: 0 });
    expect(seen.map((e) => e.step)).not.toContain("DEPLOY_STACK");
    expect(result.current.session?.status).toBe("completed");
    expect(result.current.session?.deploymentConfig?.authorityMode).toBe("admin_managed");
  });

  describe("bootstrap coordinator identity", () => {
    const ORIGINAL = "0x2000000000000000000000000000000000000002";
    const CHANGED = "0x3000000000000000000000000000000000000003";
    const holders = { deployer: true, timelock: false, bootstrapCoordinator: false };

    function snapshot() {
      return {
        communityId: 77,
        modules: { valuableActionRegistryMatches: true },
        vptInitialized: true,
        roles: {
          rrPositionManager: true,
          verifierManagerCallerEngagements: true,
          rrDistributor: true,
          commerceDisputesCaller: true,
          cohortRevenueRouter: true,
          housingMarketplaceCaller: true,
          cohortInvestmentRecorder: true,
          vaIssuerRequestHub: true,
          vaIssuerPositionManager: true,
          vaIssuerInvestmentCohortManager: true,
          vaIssuerCredentialManager: true,
          membershipMinterEngagements: true,
          vaSbtManagerRegistry: true
        },
        marketplaceActive: true,
        revenueTreasurySet: true,
        authority: holders
      };
    }

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
    });

    it("verifies the coordinator persisted with the session, not the current env value", async () => {
      mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });
      process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = CHANGED;

      const probes: Array<{ bootstrapCoordinator?: string } | undefined> = [];
      const sessionsSeen: Array<string | undefined> = [];
      const { result } = renderHook(
        () =>
          useDeployWizard({
            stepExecutor: async (_step, session) => {
              sessionsSeen.push((session as any).bootstrapCoordinator);
              return {};
            },
            readVerificationSnapshot: async (_c: number, _ch: number, _a: unknown, probe?: any) => {
              probes.push(probe);
              return snapshot();
            }
          }),
        { wrapper: TestWrapper }
      );

      const interrupted = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
      interrupted.communityId = 77;
      interrupted.status = "failed";
      interrupted.deploymentConfig = { ...validConfig(), authorityMode: "admin_managed" };
      (interrupted as any).bootstrapCoordinator = ORIGINAL;
      interrupted.steps = ["PRECHECKS", "DEPLOY_STACK", "CONFIGURE_ACCESS_PERMISSIONS"].reduce(
        (steps, key) => transitionStep(steps, key as any, "succeeded"),
        applyAuthorityModeToSteps(interrupted.steps, "admin_managed")
      );

      await act(async () => {
        await result.current.run({ ...validConfig(), authorityMode: "admin_managed" }, interrupted);
      });

      expect(sessionsSeen).toContain(ORIGINAL);
      expect(sessionsSeen).not.toContain(CHANGED);
      expect(probes.length).toBeGreaterThan(0);
      expect(probes.every((probe) => probe?.bootstrapCoordinator === ORIGINAL)).toBe(true);
    });

    it("persists the coordinator in force when a fresh deployment starts", async () => {
      mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });
      process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = ORIGINAL;

      const { result } = renderHook(
        () =>
          useDeployWizard({
            stepExecutor: async (step) => (step === "DEPLOY_STACK" ? { communityId: 77 } : {}),
            readVerificationSnapshot: async () => snapshot()
          }),
        { wrapper: TestWrapper }
      );

      await act(async () => {
        await result.current.run({ ...validConfig(), authorityMode: "admin_managed" });
      });

      expect((result.current.session as any)?.bootstrapCoordinator).toBe(ORIGINAL);
    });
  });

  it("resumes INITIAL_VOTING_POWER after a failure without duplicating recorded tx hashes", async () => {
    mockWagmiHooks({
      connected: true,
      address: "0xabc1230000000000000000000000000000000000",
      chainId: 84532
    });
    const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`;
    const executed: string[] = [];
    let votingPowerAttempts = 0;

    const { result } = renderHook(
      () =>
        useDeployWizard({
          stepExecutor: async (step, _session, context) => {
            executed.push(step);
            if (step === "DEPLOY_STACK") return { communityId: 77 };
            if (step === "INITIAL_VOTING_POWER") {
              votingPowerAttempts += 1;
              if (votingPowerAttempts === 1) {
                context.onTxConfirmed?.(hash(1));
                context.onTxConfirmed?.(hash(2));
                throw new Error("delegate failed");
              }
              // The executor resends only the missing txs; hashes already recorded are not duplicated.
              context.onTxConfirmed?.(hash(2));
              context.onTxConfirmed?.(hash(3));
              context.onTxConfirmed?.(hash(4));
            }
            return {};
          },
          readVerificationSnapshot: async () => {
            throw new Error("stop after voting power");
          }
        }),
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await result.current.run(validConfig());
    });
    const failed = result.current.session!;
    expect(failed.steps.find((s) => s.key === "INITIAL_VOTING_POWER")?.status).toBe("failed");
    expect(failed.steps.find((s) => s.key === "INITIAL_VOTING_POWER")?.txHashes).toEqual([hash(1), hash(2)]);

    const executedBefore = executed.length;
    await act(async () => {
      await result.current.run(validConfig(), failed);
    });
    const resumed = executed.slice(executedBefore);
    expect(resumed[0]).toBe("INITIAL_VOTING_POWER");
    expect(resumed).not.toContain("DEPLOY_STACK");
    const step = result.current.session!.steps.find((s) => s.key === "INITIAL_VOTING_POWER")!;
    expect(step.status).toBe("succeeded");
    expect(step.txHashes).toEqual([hash(1), hash(2), hash(3), hash(4)]);
  });
});
