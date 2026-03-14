"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useChainId } from "wagmi";
import type { CommunityDeploymentConfig } from "../../lib/deploy/config";

const STABLE_TOKENS_BY_CHAIN: Record<number, { label: string; address: string }[]> = {
  84532: [{ label: "USDC (Base Sepolia)", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }],
  8453: [{ label: "USDC (Base)", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }]
};

const CONFIG_STEPS = [
  { key: "name", title: "Community name", description: "Give your community a name" },
  { key: "description", title: "Description", description: "Describe your community's purpose" },
  { key: "currency", title: "Currency", description: "Choose the stable currency for payments and treasury" }
] as const;

type Props = {
  value: CommunityDeploymentConfig;
  validationErrors: string[];
  onChange: (next: CommunityDeploymentConfig) => void;
  onCreateCommunity?: () => void;
  isRunning?: boolean;
};

function updateField(
  value: CommunityDeploymentConfig,
  onChange: (next: CommunityDeploymentConfig) => void,
  key: keyof CommunityDeploymentConfig,
  nextValue: string
) {
  onChange({ ...value, [key]: nextValue });
}

export function DeployConfigSteps({ value, validationErrors, onChange, onCreateCommunity, isRunning }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const chainId = useChainId();
  const tokenOptions = STABLE_TOKENS_BY_CHAIN[chainId] ?? STABLE_TOKENS_BY_CHAIN[84532];
  const currentStep = CONFIG_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === CONFIG_STEPS.length - 1;
  const canGoNext = (() => {
    if (stepIndex === 0) return value.communityName.trim().length > 0;
    if (stepIndex === 1) return value.communityDescription.trim().length > 0;
    return value.treasuryStableToken.trim().length > 0;
  })();
  const canCreate = validationErrors.length === 0 && value.treasuryStableToken.trim().length > 0;

  function handleNext() {
    if (isLastStep && canCreate && onCreateCommunity) {
      onCreateCommunity();
    } else if (canGoNext && !isLastStep) {
      setStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (!isFirstStep) setStepIndex((i) => i - 1);
  }

  function handleSelectToken(address: string) {
    onChange({
      ...value,
      treasuryStableToken: address,
      supportedTokensCsv: address
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex items-start gap-2">
          {CONFIG_STEPS.map((step, i) => (
          <div key={step.key} className="flex items-start gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                i < stepIndex ? "bg-primary text-primary-foreground" : i === stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < stepIndex ? "✓" : i + 1}
            </div>
            {i < CONFIG_STEPS.length - 1 ? (
              <div className={`mt-4 h-0.5 w-6 shrink-0 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />
            ) : null}
          </div>
        ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground">{currentStep.description}</p>
        </div>

        {currentStep.key === "name" && (
          <label className="block space-y-2">
            <span className="text-sm font-medium">Community name</span>
            <input
              id="community-name"
              type="text"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              value={value.communityName}
              onChange={(e) => updateField(value, onChange, "communityName", e.target.value)}
              placeholder="e.g. Shift Builders Collective"
              autoFocus
              aria-label="Community name"
            />
          </label>
        )}

        {currentStep.key === "description" && (
          <label className="block space-y-2">
            <span className="text-sm font-medium">Description</span>
            <textarea
              id="community-description"
              className="min-h-24 w-full rounded-xl border border-border bg-background px-4 py-3 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              value={value.communityDescription}
              onChange={(e) => updateField(value, onChange, "communityDescription", e.target.value)}
              placeholder="Short purpose and operating model for this community"
              autoFocus
              aria-label="Community description"
            />
          </label>
        )}

        {currentStep.key === "currency" && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Community currency</span>
            <p className="text-xs text-muted-foreground">
              Your community will use this currency for payments and treasury.
            </p>
            <div className="flex flex-col gap-2">
              {tokenOptions.map((opt) => (
                <button
                  key={opt.address}
                  type="button"
                  onClick={() => handleSelectToken(opt.address)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    value.treasuryStableToken === opt.address
                      ? "border-secondary bg-secondary/10"
                      : "border-border hover:border-secondary/50"
                  }`}
                >
                  <span>{opt.label}</span>
                  {value.treasuryStableToken === opt.address ? (
                    <span className="text-sm font-medium text-secondary">Selected</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {validationErrors.length > 0 && currentStep.key === "currency" ? (
        <p className="text-sm text-destructive">Please select a currency.</p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstStep}
          className="btn-ghost flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </button>
        <span className="text-sm text-muted-foreground">
          Step {stepIndex + 1} of {CONFIG_STEPS.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext || (isLastStep && !canCreate) || isRunning}
          className="btn-primary flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLastStep ? "Create community" : "Next"}
          {!isLastStep ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
