"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useChainId } from "wagmi";
import type { CommunityDeploymentConfig } from "../../lib/deploy/config";
import type { PreflightAssessment } from "../../lib/deploy/types";

const STABLE_TOKENS_BY_CHAIN: Record<number, { label: string; address: string }[]> = {
  84532: [{ label: "USDC (Base Sepolia)", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }],
  8453: [{ label: "USDC (Base)", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }]
};

const CONFIG_STEPS = [
  { key: "name", title: "Community name", description: "Give your community a clear name" },
  { key: "description", title: "Description", description: "Describe your community purpose and scope" },
  { key: "currency", title: "Currency", description: "Choose the stable currency for treasury and payments" },
  { key: "ready", title: "Preflight checks", description: "Validate wallet, network, and ETH for gas" },
  { key: "review", title: "Review and confirm", description: "Review final details before deploying" }
] as const;

function weiToEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth >= 1 ? eth.toFixed(2) : eth.toFixed(4);
}

const CHAIN_NAMES: Record<number, string> = {
  84532: "Base Sepolia",
  8453: "Base",
  11155111: "Ethereum Sepolia",
  1: "Ethereum"
};

const KNOWN_TEST_ADDRESSES = [
  "0xabc1230000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0x000000000000000000000000000000000000beef"
];

function isLikelyMockAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  return KNOWN_TEST_ADDRESSES.some((a) => lower === a.toLowerCase());
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type Props = {
  value: CommunityDeploymentConfig;
  validationErrors: string[];
  onChange: (next: CommunityDeploymentConfig) => void;
  onCreateCommunity?: () => void;
  isRunning?: boolean;
  preflight: PreflightAssessment | null;
  runPreflight: () => Promise<PreflightAssessment | null>;
  connectedAddress?: `0x${string}`;
  designMode?: boolean;
  onDesignModeChange?: (enabled: boolean) => void;
  onExit?: () => void;
};

function updateField(
  value: CommunityDeploymentConfig,
  onChange: (next: CommunityDeploymentConfig) => void,
  key: keyof CommunityDeploymentConfig,
  nextValue: string
) {
  onChange({ ...value, [key]: nextValue });
}

export function DeployConfigSteps({
  value,
  validationErrors,
  onChange,
  onCreateCommunity,
  isRunning,
  preflight,
  runPreflight,
  connectedAddress,
  designMode = false,
  onDesignModeChange,
  onExit
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chainId = useChainId();
  const tokenOptions = STABLE_TOKENS_BY_CHAIN[chainId] ?? STABLE_TOKENS_BY_CHAIN[84532];
  const currentStep = CONFIG_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === CONFIG_STEPS.length - 1;
  const isPreflightStep = currentStep.key === "ready";
  const isReviewStep = currentStep.key === "review";
  const walletAddr = connectedAddress ?? preflight?.connectedAddress;
  const likelyMock = isLikelyMockAddress(walletAddr);

  useEffect(() => {
    if (isPreflightStep) void runPreflight();
  }, [isPreflightStep, runPreflight]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await runPreflight();
    } finally {
      setIsRefreshing(false);
    }
  }, [runPreflight]);

  const canGoNext = (() => {
    if (stepIndex === 0) return value.communityName.trim().length > 0;
    if (stepIndex === 1) return value.communityDescription.trim().length > 0;
    if (stepIndex === 2) return value.treasuryStableToken.trim().length > 0;
    if (stepIndex === 3) return true;
    return false;
  })();
  const preflightPassed = !preflight || preflight.blockingReasons.length === 0;
  const blockedByInsufficientFunds =
    preflight?.blockingReasons.some((r) => r.toLowerCase().includes("insufficient")) ?? false;
  const canCreate =
    validationErrors.length === 0 &&
    value.treasuryStableToken.trim().length > 0 &&
    (preflightPassed || (designMode && blockedByInsufficientFunds));
  const estimatedTxCount = preflight?.funding.estimatedTxCount ?? 11;
  const selectedTokenLabel =
    tokenOptions.find((opt) => opt.address.toLowerCase() === value.treasuryStableToken.toLowerCase())?.label ??
    "Unknown token";

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
              placeholder="Purpose and operating model of the community"
              autoFocus
              aria-label="Community description"
            />
          </label>
        )}

        {currentStep.key === "currency" && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Community currency</span>
            <p className="text-xs text-muted-foreground">
              This currency will be used for payments and treasury operations.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tokenOptions.map((opt) => (
                <button
                  key={opt.address}
                  type="button"
                  onClick={() => handleSelectToken(opt.address)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background/80 px-3 py-2 text-left text-sm transition-colors ${
                    value.treasuryStableToken === opt.address
                      ? "border-primary/50"
                      : "hover:border-primary/30"
                  }`}
                >
                    <span>{opt.label}</span>
                  {value.treasuryStableToken === opt.address ? (
                    <span className="text-sm font-medium text-primary">Selected</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep.key === "ready" && (
          <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
            {!preflight && !isRefreshing ? (
              <p className="text-sm text-muted-foreground">Checking wallet and network…</p>
            ) : (
              <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Preflight check</span>
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={() => void handleRefresh()}
                  className="flex items-center gap-1.5 text-xs text-primary underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Refreshing…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              {likelyMock && walletAddr ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Test/mock address detected: {walletAddr}. Data may not reflect a real wallet.
                </p>
              ) : null}
              {walletAddr && !likelyMock ? (
                <p className="break-all text-xs text-muted-foreground font-mono" title={walletAddr}>
                  Wallet: {shortenAddress(walletAddr)} — {walletAddr}
                </p>
              ) : null}
                {preflight ? (
                  <>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        Wallet:{" "}
                        <span className={preflight.walletConnected ? "text-primary" : "text-destructive"}>
                          {preflight.walletConnected ? "Connected" : "Disconnected"}
                        </span>
                      </p>
                      <p>
                        Network:{" "}
                        <span className={preflight.supportedNetwork ? "text-primary" : "text-destructive"}>
                          {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
                          {preflight.supportedNetwork ? " (supported)" : " (unsupported)"}
                        </span>
                      </p>
                      <p>
                        Balance: {weiToEth(preflight.funding.currentBalanceWei)} ETH on {CHAIN_NAMES[chainId] ?? `chain ${chainId}`}
                        {preflight.funding.isSufficient ? (
                          <span className="ml-1 text-primary">(sufficient)</span>
                        ) : (
                          <span className="ml-1 text-destructive">(insufficient)</span>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        Required: ~{weiToEth(preflight.funding.requiredWei)} ETH for gas
                      </p>
                    </div>
                    {preflight.blockingReasons.length > 0 ? (
                      <>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                          {preflight.blockingReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                        {blockedByInsufficientFunds && onDesignModeChange ? (
                          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
                            <p className="mb-2 text-xs text-amber-800">
                              No gas funds available? Enable design mode to preview the full flow without running transactions.
                            </p>
                            <button
                              type="button"
                              onClick={() => onDesignModeChange(!designMode)}
                              className="cursor-pointer rounded-lg bg-amber-200 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-300"
                            >
                              {designMode ? "Disable design mode" : "Continue in design mode"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm font-medium text-primary">All checks passed. You can continue to final review.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Refreshing preflight status…</p>
                )}
              </>
            )}
          </div>
        )}

        {isReviewStep ? (
          <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Review this information before sending on-chain transactions.
            </p>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Community</dt>
                <dd className="font-medium text-foreground">{value.communityName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Description</dt>
                <dd className="text-foreground">{value.communityDescription}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Stable currency</dt>
                <dd className="text-foreground">
                  <span className="font-medium">{selectedTokenLabel}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{value.treasuryStableToken}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Network</dt>
                <dd className="text-foreground">{CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Estimated transactions</dt>
                <dd className="text-foreground">{estimatedTxCount} approx.</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      {validationErrors.length > 0 && currentStep.key === "currency" ? (
        <p className="text-sm text-destructive">Select a currency to continue.</p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        {isFirstStep && onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="btn-ghost flex cursor-pointer items-center"
          >
            Exit
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep}
            className="btn-ghost flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          Step {stepIndex + 1} of {CONFIG_STEPS.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={isLastStep ? !canCreate || isRunning : !canGoNext || isRunning}
          className="btn-primary flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLastStep
            ? designMode
              ? `Simulate deploy (${estimatedTxCount} tx approx.)`
              : `Deploy community (${estimatedTxCount} tx approx.)`
            : "Next"}
          {!isLastStep ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
