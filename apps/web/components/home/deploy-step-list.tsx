import { Check } from "lucide-react";
import type { DeploymentStepState } from "../../lib/deploy/types";
import { STEP_META, WIZARD_STEP_ORDER } from "../../lib/deploy/wizard-machine";

type Props = {
  steps: DeploymentStepState[];
};

const SHORT_LABELS: Record<string, string> = {
  PRECHECKS: "Preflight",
  DEPLOY_STACK: "Deploy",
  WIRE_ROLES: "Wire Roles",
  VERIFY_DEPLOYMENT: "Verify"
};

export function DeployStepList({ steps }: Props) {
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
  const hasTxProgress =
    currentStep && currentStep.expectedTxCount > 0 && currentStep.status === "running";

  return (
    <section className="flex flex-col items-center gap-6 pt-2">
      {hasTxProgress ? (
        <div className="w-full max-w-xs rounded-lg border border-border bg-muted/30 px-4 py-2 text-center">
          <p className="text-sm font-medium">
            {currentStep.confirmedTxCount} of {currentStep.expectedTxCount} transactions confirmed
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round((currentStep.confirmedTxCount / currentStep.expectedTxCount) * 100)}%`
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex items-start justify-center gap-1 sm:gap-2">
        {order.map((step, i) => {
          const isDone = i < idx || (i === idx && step.status === "succeeded");
          const isCurrent = i === idx;
          const isRunning = isCurrent && step.status === "running";
          const label = SHORT_LABELS[step.key] ?? step.name;
          return (
            <div key={step.key} className="flex items-start">
              <div className="flex flex-col items-center gap-1">
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
                  className={`max-w-[4rem] truncate text-[10px] sm:max-w-[5rem] sm:text-xs ${
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                  title={step.name}
                >
                  {label}
                </span>
                {isRunning && step.expectedTxCount > 0 ? (
                  <span className="text-[10px] text-muted-foreground">
                    {step.confirmedTxCount}/{step.expectedTxCount}
                  </span>
                ) : null}
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
