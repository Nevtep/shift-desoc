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
            if (step === "WIRE_ROLES") {
              return {
                txHashes: ["0x2000000000000000000000000000000000000000000000000000000000000002"]
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
            if (step === "WIRE_ROLES") {
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
    expect(result.current.session?.lastError?.stepKey).toBe("WIRE_ROLES");
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
            if (step === "WIRE_ROLES") {
              return {
                txHashes: ["0x2000000000000000000000000000000000000000000000000000000000000002"]
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
});
