import { describe, expect, it } from "vitest";

import {
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
      "HANDOFF_ADMIN_TO_TIMELOCK",
      "VERIFY_DEPLOYMENT"
    ]);
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
