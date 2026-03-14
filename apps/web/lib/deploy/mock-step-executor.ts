/**
 * Mock step executor for design/demo mode.
 * Simulates deployment progress without executing real transactions.
 * Use when wallet has insufficient balance to test the full wizard flow.
 */

import type { CommunityDeploymentConfig } from "./config";
import type { DeploymentWizardSession, PreflightAssessment, StepKey } from "./types";
import type { StepExecutionResult } from "./default-step-executor";
import { STEP_META } from "./wizard-machine";

const MOCK_DELAY_MS = 1800;
const MOCK_COMMUNITY_ID = 99999;

function fakeTxHash(step: StepKey, index: number): `0x${string}` {
  const str = `${step}-${index}-${Date.now()}`;
  const hex = Array.from(str)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .padEnd(64, "0")
    .slice(0, 64);
  return `0x${hex}` as `0x${string}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockStepExecutor(): (
  step: StepKey,
  session: DeploymentWizardSession,
  context: { config: CommunityDeploymentConfig; chainId: number; preflight: PreflightAssessment }
) => Promise<StepExecutionResult> {
  return async (step, session, _context) => {
    await delay(MOCK_DELAY_MS);

    if (step === "PRECHECKS") {
      return {};
    }

    if (step === "DEPLOY_STACK") {
      const expectedTxCount = STEP_META.DEPLOY_STACK.expectedTxCount;
      const txHashes = Array.from({ length: expectedTxCount }, (_, i) =>
        fakeTxHash("DEPLOY_STACK", i)
      );
      return { txHashes, communityId: MOCK_COMMUNITY_ID };
    }

    if (step === "WIRE_ROLES") {
      const expectedTxCount = STEP_META.WIRE_ROLES.expectedTxCount;
      const txHashes = Array.from({ length: expectedTxCount }, (_, i) =>
        fakeTxHash("WIRE_ROLES", i)
      );
      return { txHashes };
    }

    if (step === "VERIFY_DEPLOYMENT") {
      return {};
    }

    return {};
  };
}

/**
 * Mock verification snapshot reader for design mode.
 * Returns all checks as passed so the wizard completes successfully.
 */
export async function mockReadVerificationSnapshot(
  _communityId: number,
  _chainId: number
): Promise<{
  modules: { valuableActionRegistryMatches: boolean };
  vptInitialized: boolean;
  roles: {
    rrPositionManager: boolean;
    rrDistributor: boolean;
    commerceDisputesCaller: boolean;
    housingMarketplaceCaller: boolean;
    vaIssuerRequestHub: boolean;
  };
  marketplaceActive: boolean;
  revenueTreasurySet: boolean;
}> {
  return {
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
  };
}
