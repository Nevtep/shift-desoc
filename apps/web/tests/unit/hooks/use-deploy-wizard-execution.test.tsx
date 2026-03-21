import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDeployWizard } from "../../../hooks/useDeployWizard";
import { mockWagmiHooks, TestWrapper } from "../utils";

function validConfig() {
  return {
    communityName: "Shift Wizard Deployment",
    communityDescription: "Deployment from manager wizard",
    communityMetadataUri: "",
    treasuryVault: "0x1111111111111111111111111111111111111111",
    treasuryStableToken: "0x2222222222222222222222222222222222222222",
    supportedTokensCsv: "0x2222222222222222222222222222222222222222"
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
            if (step === "HANDOFF_ADMIN_TO_TIMELOCK") {
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
              rrDistributor: true,
              commerceDisputesCaller: true,
              housingMarketplaceCaller: true,
              vaIssuerRequestHub: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true
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
            if (step === "HANDOFF_ADMIN_TO_TIMELOCK") {
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
                rrDistributor: verificationCallCount > 1,
                commerceDisputesCaller: verificationCallCount > 1,
                housingMarketplaceCaller: verificationCallCount > 1,
                vaIssuerRequestHub: verificationCallCount > 1
              },
              marketplaceActive: verificationCallCount > 1,
              revenueTreasurySet: verificationCallCount > 1
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
            if (step === "HANDOFF_ADMIN_TO_TIMELOCK") {
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
              rrDistributor: true,
              commerceDisputesCaller: true,
              housingMarketplaceCaller: true,
              vaIssuerRequestHub: true
            },
            marketplaceActive: true,
            revenueTreasurySet: true
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
});
