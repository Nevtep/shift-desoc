import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDeployResume } from "../../../hooks/useDeployResume";
import { saveSession } from "../../../lib/deploy/session-store";
import { createInitialSession } from "../../../lib/deploy/wizard-machine";
import { mockWagmiHooks, TestWrapper } from "../utils";

describe("useDeployResume", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("allows same wallet and blocks different wallet", async () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    session.status = "failed";
    saveSession(session);

    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });
    const { result: sameWallet } = renderHook(() => useDeployResume(), { wrapper: TestWrapper });
    const resumed = await sameWallet.current.resume();
    expect(resumed).not.toBeNull();

    mockWagmiHooks({ connected: true, address: "0xdef4560000000000000000000000000000000000", chainId: 84532 });
    const { result: differentWallet } = renderHook(() => useDeployResume(), { wrapper: TestWrapper });
    const blocked = await differentWallet.current.resume();
    expect(blocked).toBeNull();
  });

  it("uses on-chain reader for registered communities and ignores local deployment json authority", async () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    session.status = "in-progress";
    session.communityId = 1;
    session.targetType = "registered";
    saveSession(session);

    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });

    const { result } = renderHook(
      () =>
        useDeployResume(async () => ({
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
          revenueTreasurySet: true
        })),
      { wrapper: TestWrapper }
    );

    const resumed = await result.current.resume({ communityId: 1 });
    expect(resumed?.status).toBe("completed");
  });

  it("recovers first incomplete registered community when wallet has multiple communities", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });

    const { result } = renderHook(
      () =>
        useDeployResume(
          async (communityId) => {
            if (communityId === 4) {
              return {
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
                revenueTreasurySet: true
              };
            }

            return {
              modules: { valuableActionRegistryMatches: false },
              vptInitialized: false,
              roles: {
                rrPositionManager: false,
                verifierManagerCallerEngagements: false,
                rrDistributor: false,
                commerceDisputesCaller: false,
                cohortRevenueRouter: false,
                housingMarketplaceCaller: false,
                cohortInvestmentRecorder: false,
                vaIssuerRequestHub: false,
                vaIssuerPositionManager: false,
                vaIssuerInvestmentCohortManager: false,
                vaIssuerCredentialManager: false,
                membershipMinterEngagements: false,
                vaSbtManagerRegistry: false
              },
              marketplaceActive: false,
              revenueTreasurySet: false
            };
          },
          async () => [4, 3]
        ),
      { wrapper: TestWrapper }
    );

    const resumed = await result.current.resume();
    expect(resumed?.communityId).toBe(3);
    expect(resumed?.targetType).toBe("registered");
    expect(resumed?.status).toBe("in-progress");
    expect(resumed?.steps.find((step) => step.key === "PRECHECKS")?.status).toBe("succeeded");
    expect(resumed?.steps.find((step) => step.key === "DEPLOY_STACK")?.status).toBe("failed");
  });

  it("hydrates deployment config when resuming recovered on-chain community", async () => {
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });

    const { result } = renderHook(
      () =>
        useDeployResume(
          async () => ({
            modules: { valuableActionRegistryMatches: false },
            vptInitialized: false,
            roles: {
              rrPositionManager: false,
              verifierManagerCallerEngagements: false,
              rrDistributor: false,
              commerceDisputesCaller: false,
              cohortRevenueRouter: false,
              housingMarketplaceCaller: false,
              cohortInvestmentRecorder: false,
              vaIssuerRequestHub: false,
              vaIssuerPositionManager: false,
              vaIssuerInvestmentCohortManager: false,
              vaIssuerCredentialManager: false,
              membershipMinterEngagements: false,
              vaSbtManagerRegistry: false
            },
            marketplaceActive: false,
            revenueTreasurySet: false
          }),
          async () => [3],
          async () => ({
            communityName: "Recovered Community",
            communityDescription: "Recovered description",
            communityMetadataUri: "ipfs://recovered",
            treasuryVault: "0x1111111111111111111111111111111111111111",
            treasuryStableToken: "0x2222222222222222222222222222222222222222",
            supportedTokensCsv: "0x2222222222222222222222222222222222222222"
          })
        ),
      { wrapper: TestWrapper }
    );

    const resumed = await result.current.resume();
    expect(resumed?.deploymentConfig?.communityName).toBe("Recovered Community");
    expect(resumed?.deploymentConfig?.treasuryStableToken).toBe(
      "0x2222222222222222222222222222222222222222"
    );
  });
});
