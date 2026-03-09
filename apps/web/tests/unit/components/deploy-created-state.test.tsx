import { describe, expect, it } from "vitest";

import { createInitialSession, isCreatedState, transitionStep } from "../../../lib/deploy/wizard-machine";

describe("Created-state gating", () => {
  it("requires registration and verification checks before created", () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    expect(isCreatedState(session)).toBe(false);

    session.communityId = 1;
    expect(isCreatedState(session)).toBe(false);

    session.steps = transitionStep(session.steps, "VERIFY_DEPLOYMENT", "succeeded");
    expect(isCreatedState(session)).toBe(true);
  });

  it("does not treat partial progress as created", () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    session.communityId = 1;
    session.steps = transitionStep(session.steps, "DEPLOY_STACK", "succeeded");
    expect(isCreatedState(session)).toBe(false);
  });
});
