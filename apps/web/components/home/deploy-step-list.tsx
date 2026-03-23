"use client";

import { Check, Loader2 } from "lucide-react";
import type { DeploymentStepState } from "../../lib/deploy/types";
import { STEP_META, WIZARD_STEP_ORDER } from "../../lib/deploy/wizard-machine";

type Props = {
  steps: DeploymentStepState[];
  betweenTxListAndStepper?: React.ReactNode;
};

const SHORT_LABELS: Record<string, string> = {
  PRECHECKS: "Preflight",
  DEPLOY_STACK: "Deploy Layers",
  CONFIGURE_ACCESS_PERMISSIONS: "Wire Registry",
  HANDOFF_ADMIN_TO_TIMELOCK: "Handoff",
  VERIFY_DEPLOYMENT: "Verify"
};

const TX_LABELS: Record<string, string> = {
  DEPLOY_STACK: "Layer deployment",
  CONFIGURE_ACCESS_PERMISSIONS: "Permission and registry wiring",
  HANDOFF_ADMIN_TO_TIMELOCK: "Admin handoff"
};

const ACCESS_WIRING_LABELS = [
  "Bootstrap community registry",
  "Apply access-role wiring",
  "Run post-wiring setup"
];

const HANDOFF_LABELS = [
  "Grant timelock admin role",
  "Revoke deployer admin role",
  "Revoke bootstrap coordinator admin role"
];

function TxItem({
  index,
  total,
  confirmed,
  isCurrent,
  stepKey
}: {
  index: number;
  total: number;
  confirmed: number;
  isCurrent: boolean;
  stepKey: string;
}) {
  const done = index < confirmed;
  const inProgress = isCurrent && index === confirmed;
  const baseLabel =
    stepKey === "DEPLOY_STACK"
      ? TX_LABELS[stepKey] ?? "Transaction"
      : stepKey === "CONFIGURE_ACCESS_PERMISSIONS"
        ? ACCESS_WIRING_LABELS[Math.min(index, ACCESS_WIRING_LABELS.length - 1)] ?? TX_LABELS[stepKey] ?? "Transaction"
        : stepKey === "HANDOFF_ADMIN_TO_TIMELOCK"
          ? HANDOFF_LABELS[index] ?? TX_LABELS[stepKey] ?? "Transaction"
      : TX_LABELS[stepKey] ?? "Transaction";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm transition-colors ${
        done
          ? "border-primary/50"
          : inProgress
            ? "border-primary/50"
            : ""
      }`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        {done ? (
          <Check className="h-4 w-4 text-primary" aria-hidden />
        ) : inProgress ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
        )}
      </span>
      <span className={done ? "font-medium text-primary" : inProgress ? "font-medium text-foreground" : "text-muted-foreground"}>
        {baseLabel} {index + 1} of {total}
        {done ? " — confirmed" : inProgress ? " — confirming…" : " — pending"}
      </span>
    </div>
  );
}

export function DeployStepList({ steps, betweenTxListAndStepper }: Props) {
  const order = steps.length > 0 ? steps : WIZARD_STEP_ORDER.map((key) => ({
    key,
    name: STEP_META[key].name,
    purpose: STEP_META[key].purpose,
    status: "pending" as const,
    expectedTxCount: STEP_META[key].expectedTxCount,
    confirmedTxCount: 0,
    txHashes: [] as `0x${string}`[]
  }));
  const currentIdx = order.findIndex((s) => s.status !== "succeeded");
  const idx = currentIdx < 0 ? order.length - 1 : Math.max(0, currentIdx);

  const currentStep = order[idx];
  const currentStepTxSlots =
    currentStep?.status === "running"
      ? Math.max(currentStep.expectedTxCount, currentStep.confirmedTxCount + 1)
      : currentStep?.expectedTxCount ?? 0;
  const hasTxList =
    currentStep && currentStepTxSlots > 0 && currentStep.status === "running";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-2">
      {hasTxList ? (
        <div className="w-full space-y-2">
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {SHORT_LABELS[currentStep.key] ?? currentStep.name}
            </p>
            <p className="text-xs text-muted-foreground/90">
              {currentStep.purpose ?? STEP_META[currentStep.key].purpose}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: currentStepTxSlots }, (_, i) => (
              <TxItem
                key={i}
                index={i}
                total={currentStepTxSlots}
                confirmed={currentStep.confirmedTxCount}
                isCurrent={currentStep.status === "running"}
                stepKey={currentStep.key}
              />
            ))}
          </div>
        </div>
      ) : null}
      {betweenTxListAndStepper}
      <div className="flex w-full items-start justify-center gap-1 sm:gap-2">
        {order.map((step, i) => {
          const isDone = i < idx || (i === idx && step.status === "succeeded");
          const isCurrent = i === idx;
          const label = SHORT_LABELS[step.key] ?? step.name;
          return (
            <div key={step.key} className="flex items-start">
              <div className="flex max-w-[6.5rem] flex-col items-center gap-1 text-center sm:max-w-[8rem]">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors sm:size-10 ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : i + 1}
                </div>
                <span
                  className={`max-w-[6rem] truncate text-[10px] sm:max-w-[8rem] sm:text-xs ${
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                  title={step.name}
                >
                  {label}
                </span>
                <span
                  className={`line-clamp-2 text-[9px] leading-tight sm:text-[10px] ${
                    isCurrent ? "text-foreground/80" : "text-muted-foreground/80"
                  }`}
                  title={step.purpose ?? STEP_META[step.key].purpose}
                >
                  {step.purpose ?? STEP_META[step.key].purpose}
                </span>
              </div>
              {i < order.length - 1 ? (
                <div
                  className={`mx-0.5 mt-5 h-0.5 w-4 shrink-0 sm:mx-1 sm:w-8 ${
                    i < idx ? "bg-primary" : "bg-muted"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
