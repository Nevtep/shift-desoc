import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSessionsForDeployerChain,
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

  it("clears all sessions for deployer and chain", () => {
    const deployer = "0xabc1230000000000000000000000000000000000" as const;

    const sameChainA = createInitialSession(deployer, 84532);
    sameChainA.sessionId = `${sameChainA.sessionId}-a`;
    sameChainA.status = "failed";
    saveSession(sameChainA);

    const sameChainB = createInitialSession(deployer, 84532);
    sameChainB.sessionId = `${sameChainB.sessionId}-b`;
    sameChainB.status = "in-progress";
    saveSession(sameChainB);

    const otherChain = createInitialSession(deployer, 8453);
    otherChain.sessionId = `${otherChain.sessionId}-c`;
    otherChain.status = "in-progress";
    saveSession(otherChain);

    const otherDeployer = createInitialSession("0xdef4560000000000000000000000000000000000", 84532);
    otherDeployer.sessionId = `${otherDeployer.sessionId}-d`;
    otherDeployer.status = "in-progress";
    saveSession(otherDeployer);

    clearSessionsForDeployerChain(deployer, 84532);

    expect(getSession(sameChainA.sessionId)).toBeNull();
    expect(getSession(sameChainB.sessionId)).toBeNull();
    expect(getSession(otherChain.sessionId)?.sessionId).toBe(otherChain.sessionId);
    expect(getSession(otherDeployer.sessionId)?.sessionId).toBe(otherDeployer.sessionId);
  });
});
