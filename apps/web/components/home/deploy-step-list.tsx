import type { DeploymentStepState } from "../../lib/deploy/types";
import { STEP_META, WIZARD_STEP_ORDER } from "../../lib/deploy/wizard-machine";

type Props = {
  steps: DeploymentStepState[];
};

export function DeployStepList({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <section className="card space-y-3">
        <h3 className="text-base font-semibold">Deployment Steps</h3>
        <p className="text-sm text-muted-foreground">
          Before you start, this is the full sequence the wizard will execute. Each step will show live transaction progress after deployment begins.
        </p>
        <ul className="space-y-2">
          {WIZARD_STEP_ORDER.map((key) => (
            <li key={key} className="card-tight">
              <div className="flex items-center justify-between">
                <p className="font-medium">{STEP_META[key].name}</p>
                <p className="text-xs uppercase text-muted-foreground">upcoming</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{STEP_META[key].purpose}</p>
              <p className="mt-2 text-xs text-muted-foreground">Expected transactions: {STEP_META[key].expectedTxCount}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="card space-y-3">
      <h3 className="text-base font-semibold">Deployment Steps</h3>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.key} className="card-tight">
            <div className="flex items-center justify-between">
              <p className="font-medium">{step.name}</p>
              <p className="text-xs uppercase text-muted-foreground">{step.status}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{step.purpose}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Transactions: {step.confirmedTxCount}/{step.expectedTxCount}
            </p>
            {step.failureReason ? (
              <p className="mt-2 text-xs text-destructive">{step.failureReason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
