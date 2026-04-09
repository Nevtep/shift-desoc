import { describe, expect, it } from "vitest";

import { getAllowlistedSignatures } from "../../../../lib/actions/allowlist";
import { listCrucialFlowsCatalog, resolveCrucialFlowsCatalog } from "../../../../lib/actions/guided-templates";

const BASELINE_FLOW_IDS = [
  "coordination.paramController.setGovernanceParams",
  "coordination.paramController.setEligibilityParams",
  "coordination.paramController.setRevenuePolicy",
  "governance.timelock.executeQueuedProposalAction",
  "verification.verifierElection.setVerifierSet",
  "verification.valuableActionRegistry.activateFromGovernance",
  "economy.treasuryAdapter.setCapBps",
  "economy.revenueRouter.setSupportedToken",
  "commerce.marketplace.setCommunityActive",
  "commerce_housing.marketplace.setCommerceDisputes"
];

describe("crucial flows catalog", () => {
  it("contains all Initial Crucial Flows v1 flow IDs", () => {
    const flowIds = listCrucialFlowsCatalog().map((flow) => flow.flowId);
    expect(flowIds).toEqual([...BASELINE_FLOW_IDS].sort((a, b) => a.localeCompare(b)));
  });

  it("ensures every disabled flow has a deterministic disabledReason", () => {
    const resolved = resolveCrucialFlowsCatalog(getAllowlistedSignatures);
    for (const flow of resolved) {
      if (!flow.enabled) {
        expect(flow.disabledReason).toBeTruthy();
      }
    }
  });

  it("enables only allowlisted representable flows", () => {
    const resolved = resolveCrucialFlowsCatalog(getAllowlistedSignatures);
    const setCapBps = resolved.find((flow) => flow.flowId === "economy.treasuryAdapter.setCapBps");
    const executeQueued = resolved.find((flow) => flow.flowId === "governance.timelock.executeQueuedProposalAction");

    expect(setCapBps?.enabled).toBe(true);
    expect(setCapBps?.disabledReason).toBeNull();
    expect(executeQueued?.enabled).toBe(false);
    expect(executeQueued?.disabledReason).toBe("Not representable as safe guided draft template");
  });
});
