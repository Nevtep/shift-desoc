import type { DeploymentStepState, DeploymentWizardSession, StepKey, StepStatus } from "./types";

export const WIZARD_STEP_ORDER: StepKey[] = [
  "PRECHECKS",
  "DEPLOY_STACK",
  "WIRE_ROLES",
  "VERIFY_DEPLOYMENT"
];

export const STEP_META: Record<StepKey, { name: string; purpose: string; expectedTxCount: number }> = {
  PRECHECKS: {
    name: "Preflight",
    purpose: "Validate wallet, network, shared infra, and funds before writes.",
    expectedTxCount: 0
  },
  DEPLOY_STACK: {
    name: "Deploy Community Stack",
    purpose: "Deploy per-community contracts and register the community.",
    expectedTxCount: 8
  },
  WIRE_ROLES: {
    name: "Wire Roles And Configuration",
    purpose: "Apply role wiring and module configuration for activation.",
    expectedTxCount: 12
  },
  VERIFY_DEPLOYMENT: {
    name: "Verify Community Deployment",
    purpose: "Run deterministic script-parity checks.",
    expectedTxCount: 0
  }
};

export function createInitialSteps(): DeploymentStepState[] {
  return WIZARD_STEP_ORDER.map((key) => ({
    key,
    name: STEP_META[key].name,
    purpose: STEP_META[key].purpose,
    status: "pending",
    expectedTxCount: STEP_META[key].expectedTxCount,
    confirmedTxCount: 0,
    txHashes: []
  }));
}

export function createInitialSession(deployerAddress: `0x${string}`, chainId: number): DeploymentWizardSession {
  const now = new Date().toISOString();
  return {
    sessionId: `${deployerAddress.toLowerCase()}-${Date.now()}`,
    deployerAddress,
    chainId,
    targetType: "pre-registration",
    status: "idle",
    createdAt: now,
    updatedAt: now,
    steps: createInitialSteps()
  };
}

export function transitionStep(
  steps: DeploymentStepState[],
  key: StepKey,
  status: StepStatus,
  patch?: Partial<DeploymentStepState>
): DeploymentStepState[] {
  return steps.map((step) => {
    if (step.key !== key) return step;
    const base: DeploymentStepState = {
      ...step,
      status,
      ...patch
    };
    if (status === "running") base.startedAt = base.startedAt ?? new Date().toISOString();
    if (status === "succeeded" || status === "failed") base.endedAt = new Date().toISOString();
    return base;
  });
}

export function firstIncompleteStep(steps: DeploymentStepState[]): StepKey {
  const pending = steps.find((s) => s.status !== "succeeded");
  return pending?.key ?? "VERIFY_DEPLOYMENT";
}

export function allRequiredChecksPassed(verificationStep: DeploymentStepState | undefined): boolean {
  return Boolean(verificationStep && verificationStep.status === "succeeded");
}

export function isCreatedState(session: DeploymentWizardSession): boolean {
  if (!session.communityId) return false;
  const verifyStep = session.steps.find((s) => s.key === "VERIFY_DEPLOYMENT");
  return allRequiredChecksPassed(verifyStep);
}

export function nextRunnableStep(steps: DeploymentStepState[]): StepKey | null {
  for (const step of steps) {
    if (step.status === "pending" || step.status === "failed") return step.key;
  }
  return null;
}

export function recordStepTx(
  steps: DeploymentStepState[],
  key: StepKey,
  txHash: `0x${string}`
): DeploymentStepState[] {
  return steps.map((step) => {
    if (step.key !== key) return step;
    const txHashes = step.txHashes.includes(txHash) ? step.txHashes : [...step.txHashes, txHash];
    return {
      ...step,
      txHashes,
      confirmedTxCount: Math.min(step.expectedTxCount, step.confirmedTxCount + 1)
    };
  });
}
