import { describe, expect, it } from "vitest";

import {
  applyAuthorityModeToSteps,
  createInitialSession,
  createInitialSteps,
  firstIncompleteStep,
  isCreatedState,
  nextRunnableStep,
  recordStepTx,
  transitionStep
} from "../../../../lib/deploy/wizard-machine";

describe("wizard-machine", () => {
  it("creates deterministic default step order", () => {
    const steps = createInitialSteps();
    expect(steps.map((s) => s.key)).toEqual([
      "PRECHECKS",
      "DEPLOY_STACK",
      "CONFIGURE_ACCESS_PERMISSIONS",
      "FINALIZE_AUTHORITY_MODE",
      "VERIFY_DEPLOYMENT"
    ]);
  });

  it("sizes FINALIZE_AUTHORITY_MODE for the selected authority mode", () => {
    const find = (steps: ReturnType<typeof createInitialSteps>) =>
      steps.find((s) => s.key === "FINALIZE_AUTHORITY_MODE")!;
    const governance = find(createInitialSteps("governance_managed"));
    const admin = find(createInitialSteps("admin_managed"));
    expect(governance.expectedTxCount).toBe(2);
    expect(governance.name).toBe("Handoff Admin To Timelock");
    expect(admin.expectedTxCount).toBe(0);
    expect(admin.name).toBe("Keep Admin-Managed Authority");
    expect(find(createInitialSteps()).expectedTxCount).toBe(2);
  });

  it("re-applies the mode to existing steps without touching progress", () => {
    let steps = createInitialSteps();
    steps = transitionStep(steps, "PRECHECKS", "succeeded");
    const next = applyAuthorityModeToSteps(steps, "admin_managed");
    expect(next.find((s) => s.key === "PRECHECKS")?.status).toBe("succeeded");
    expect(next.find((s) => s.key === "FINALIZE_AUTHORITY_MODE")?.expectedTxCount).toBe(0);
  });

  it("tracks tx confirmations per step", () => {
    const steps = createInitialSteps();
    const updated = recordStepTx(steps, "DEPLOY_STACK", "0x123" as `0x${string}`);
    const deploy = updated.find((s) => s.key === "DEPLOY_STACK");
    expect(deploy?.confirmedTxCount).toBe(1);
    expect(deploy?.txHashes).toEqual(["0x123"]);
  });

  it("infers first incomplete step and next runnable step", () => {
    let steps = createInitialSteps();
    steps = transitionStep(steps, "PRECHECKS", "succeeded");
    expect(firstIncompleteStep(steps)).toBe("DEPLOY_STACK");
    expect(nextRunnableStep(steps)).toBe("DEPLOY_STACK");
  });

  it("marks created state only after registration + verify success", () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    expect(isCreatedState(session)).toBe(false);

    session.communityId = 1;
    session.steps = transitionStep(session.steps, "VERIFY_DEPLOYMENT", "succeeded");
    expect(isCreatedState(session)).toBe(true);
  });
});
