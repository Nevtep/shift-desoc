import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSession,
  findResumeCandidate,
  getSession,
  saveSession
} from "../../../../lib/deploy/session-store";
import { createInitialSession, transitionStep } from "../../../../lib/deploy/wizard-machine";

describe("session-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and restores pre-registration session", () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    session.status = "in-progress";
    session.steps = transitionStep(session.steps, "PRECHECKS", "succeeded");
    saveSession(session);

    const restored = getSession(session.sessionId);
    expect(restored?.sessionId).toBe(session.sessionId);
    expect(restored?.steps[0].status).toBe("succeeded");
  });

  it("finds resume candidate by deployer and chain", () => {
    const a = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    a.status = "in-progress";
    saveSession(a);

    const b = createInitialSession("0xdef4560000000000000000000000000000000000", 84532);
    b.status = "in-progress";
    saveSession(b);

    const candidate = findResumeCandidate("0xabc1230000000000000000000000000000000000", 84532);
    expect(candidate?.deployerAddress.toLowerCase()).toBe("0xabc1230000000000000000000000000000000000");
  });

  it("clears stored session", () => {
    const session = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    saveSession(session);
    clearSession(session.sessionId);
    expect(getSession(session.sessionId)).toBeNull();
  });
});
