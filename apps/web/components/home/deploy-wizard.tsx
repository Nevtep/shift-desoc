"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";

import {
  createDefaultDeploymentConfig,
  validateDeploymentConfig,
  type CommunityDeploymentConfig
} from "../../lib/deploy/config";
import { useDeployResume } from "../../hooks/useDeployResume";
import { useDeployWizard, type UseDeployWizardOptions } from "../../hooks/useDeployWizard";
import { useMyDeployedCommunities } from "../../hooks/useMyDeployedCommunities";
import { WalletConnect } from "../wallet/wallet-connect";
import { DeployConfigSteps } from "./deploy-config-steps";
import { DeployStepList } from "./deploy-step-list";
import { DeployVerificationResults } from "./deploy-verification-results";
import { OnboardingConnectStep } from "./onboarding-connect-step";

type Props = {
  options?: UseDeployWizardOptions;
};

const FORM_DRAFT_STORAGE_KEY = "shift.manager.deploy.formDraft.v1";

function getTxExplorerUrl(chainId: number, txHash: `0x${string}`): string {
  const base =
    chainId === 84532
      ? "https://sepolia.basescan.org"
      : chainId === 8453
        ? "https://basescan.org"
        : chainId === 11155111
          ? "https://sepolia.etherscan.io"
          : "https://etherscan.io";
  return `${base}/tx/${txHash}`;
}

function getLatestTxHash(steps: { txHashes?: `0x${string}`[] }[]): `0x${string}` | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const hashes = steps[i]?.txHashes;
    if (hashes?.length) return hashes[hashes.length - 1];
  }
  return null;
}

function loadDraft(address?: `0x${string}`, chainId?: number): CommunityDeploymentConfig | null {
  if (!address || !chainId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${FORM_DRAFT_STORAGE_KEY}:${chainId}:${address.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as CommunityDeploymentConfig;
  } catch {
    return null;
  }
}

function saveDraft(config: CommunityDeploymentConfig, address?: `0x${string}`, chainId?: number): void {
  if (!address || !chainId || typeof window === "undefined") return;
  window.localStorage.setItem(
    `${FORM_DRAFT_STORAGE_KEY}:${chainId}:${address.toLowerCase()}`,
    JSON.stringify(config)
  );
}

export function DeployWizard({ options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const designModeFromUrl = searchParams.get("designMode") === "1";
  const [designMode, setDesignMode] = useState(designModeFromUrl);

  useEffect(() => {
    if (designModeFromUrl && !designMode) setDesignMode(true);
  }, [designModeFromUrl, designMode]);

  const { status, address } = useAccount();
  const chainId = useChainId();
  const {
    session,
    preflight,
    verificationResults,
    resumeCandidate,
    error,
    isRunning,
    runPreflight,
    run,
    setSession,
    clearAndStartOver
  } = useDeployWizard({ ...options, designMode: designMode || options?.designMode });
  const { resume, error: resumeError } = useDeployResume();
  const { hasCommunities, isLoading: isLoadingMyCommunities, refetch: refetchMyCommunities } = useMyDeployedCommunities();
  const [config, setConfig] = useState<CommunityDeploymentConfig>(() => createDefaultDeploymentConfig());
  const [isResuming, setIsResuming] = useState(false);
  const [completedDismissed, setCompletedDismissed] = useState(false);
  const [wizardExpanded, setWizardExpanded] = useState(false);
  const [wizardClosed, setWizardClosed] = useState(false);
  const resumeRequestIdRef = useRef(0);

  const isCompleted = session?.status === "completed";
  const isDeploying =
    session != null &&
    (session.status === "in-progress" || session.status === "preflight-blocked" || session.status === "failed");
  const showFullScreen = !isCompleted || !completedDismissed;
  const showHomeView =
    status === "connected" &&
    !isLoadingMyCommunities &&
    !isDeploying &&
    !isCompleted &&
    ((hasCommunities && !wizardExpanded) || wizardClosed);
  const showLoadingCheck =
    status === "connected" &&
    isLoadingMyCommunities &&
    !isDeploying &&
    !isCompleted;

  useEffect(() => {
    const draft = loadDraft(address, chainId);
    setConfig((current) => ({
      ...(draft ?? current),
      treasuryVault: draft?.treasuryVault || current.treasuryVault || address || ""
    }));
  }, [address, chainId]);

  useEffect(() => {
    saveDraft(config, address, chainId);
  }, [address, chainId, config]);

  useEffect(() => {
    if (isCompleted) void refetchMyCommunities();
  }, [isCompleted, refetchMyCommunities]);

  const configValidation = useMemo(() => validateDeploymentConfig(config), [config]);
  const canStart = useMemo(
    () => status === "connected" && configValidation.isValid && !isRunning,
    [configValidation.isValid, isRunning, status]
  );
  const canResume = useMemo(() => status === "connected" && !isRunning, [isRunning, status]);
  const hasResumableSession = Boolean(
    (session?.communityId ?? resumeCandidate?.communityId) && session?.status !== "completed"
  );
  const showResume = hasResumableSession;

  async function handleResume() {
    console.log("[DeployWizard] Resume button clicked", {
      currentSessionId: session?.sessionId,
      currentCommunityId: session?.communityId,
      resumeCandidateCommunityId: resumeCandidate?.communityId,
      connectedStatus: status
    });

    const requestId = ++resumeRequestIdRef.current;
    setIsResuming(true);
    try {
      const resumed = await resume({ communityId: session?.communityId ?? resumeCandidate?.communityId });
      if (requestId !== resumeRequestIdRef.current) return;
      if (!resumed) {
        console.log("[DeployWizard] Resume returned no session");
        return;
      }

      setSession(resumed);
      console.log("[DeployWizard] Resume session loaded", {
        resumedSessionId: resumed.sessionId,
        resumedCommunityId: resumed.communityId,
        resumedStatus: resumed.status,
        hasDeploymentConfig: Boolean(resumed.deploymentConfig)
      });

      const resumeConfig = resumed.deploymentConfig ?? config;
      if (resumed.deploymentConfig) {
        setConfig(resumed.deploymentConfig);
        saveDraft(resumed.deploymentConfig, address, chainId);
      }

      // Resume should continue execution from the first incomplete step.
      const validation = validateDeploymentConfig(resumeConfig);
      if (resumed.status !== "completed" && validation.isValid) {
        console.log("[DeployWizard] Starting run() from resumed session", {
          resumedSessionId: resumed.sessionId,
          resumedCommunityId: resumed.communityId
        });
        await run(resumeConfig, resumed);
        if (requestId !== resumeRequestIdRef.current) return;
      } else {
        console.log("[DeployWizard] Resume did not start run()", {
          reason: resumed.status === "completed" ? "session-already-completed" : "invalid-config",
          validationErrors: validation.errors
        });
      }
    } catch (error) {
      console.log("[DeployWizard] Resume handler failed", {
        error
      });
    } finally {
      if (requestId === resumeRequestIdRef.current) {
        setIsResuming(false);
      }
    }
  }

  async function handleStartDeploy() {
    // Cancel any in-flight resume result application before starting a new run.
    resumeRequestIdRef.current += 1;
    setIsResuming(false);
    await run(config);
  }

  function handleStartOver() {
    if (address && chainId && typeof window !== "undefined") {
      window.localStorage.removeItem(`${FORM_DRAFT_STORAGE_KEY}:${chainId}:${address.toLowerCase()}`);
    }
    setConfig((current) => ({
      ...createDefaultDeploymentConfig(),
      treasuryVault: address || current.treasuryVault || ""
    }));
    if (session?.sessionId) {
      clearAndStartOver(session.sessionId);
    }
  }

  if (!showFullScreen) {
    const communityId = session?.communityId;
    return (
      <section className="space-y-6">
        <p className="text-sm font-medium text-primary">Your community is ready!</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/" className="btn-ghost cursor-pointer">
            Go to home
          </Link>
          {typeof communityId === "number" ? (
            <Link
              href={`/communities/${communityId}`}
              className="btn-primary cursor-pointer"
            >
              Go to my community
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  if (status !== "connected") {
    return <OnboardingConnectStep fullScreen hideCloseButton />;
  }

  if (showLoadingCheck) {
    return (
      <section className="space-y-6">
        <p className="text-sm text-muted-foreground">Checking your communities…</p>
      </section>
    );
  }

  if (showHomeView) {
    return (
      <section className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {hasCommunities
            ? "You already have communities. Create another or browse below."
            : "Create a community or browse below."}
        </p>
        <button
          type="button"
          onClick={() => {
            setWizardClosed(false);
            setWizardExpanded(true);
          }}
          className="btn-primary cursor-pointer"
        >
          Create community
        </button>
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/contact-bg.webp)" }}
    >
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
        {designMode ? (
          <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
            Modo diseño
          </span>
        ) : null}
        <WalletConnect showAddress />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-6">
            <img
              src="/imagotipo-h.svg"
              alt="Shift DeSoc"
              className="h-16 w-auto sm:h-20"
            />
          </div>
          {isDeploying ? (
            <>
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold">
                  {session?.status === "failed"
                    ? "Deployment paused"
                    : (session?.steps ?? []).some(
                        (s) => s.key === "VERIFY_DEPLOYMENT" && (s.status === "running" || s.status === "succeeded")
                      )
                      ? "Verification"
                      : "Deploying your community"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {session?.status === "failed"
                    ? "An error occurred. Fix the issue and use Resume to continue."
                    : (session?.steps ?? []).some(
                        (s) => s.key === "VERIFY_DEPLOYMENT" && (s.status === "running" || s.status === "succeeded")
                      )
                      ? "Running verification checks."
                      : "Confirm transactions in your wallet when prompted. Do not close this page."}
                </p>
                {session?.status === "failed" ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={!canResume || isResuming}
                      onClick={() => void handleResume()}
                      className="btn-primary cursor-pointer"
                    >
                      {isResuming ? "Resuming..." : "Resume"}
                    </button>
                  </div>
                ) : null}
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {resumeError ? <p className="text-sm text-destructive">{resumeError}</p> : null}
              </div>

              <div className="mt-8 flex w-full flex-col items-center gap-8">
                <DeployVerificationResults
                  results={verificationResults}
                  isVerifying={
                    (session?.steps ?? []).some(
                      (s) => s.key === "VERIFY_DEPLOYMENT" && s.status === "running"
                    ) && verificationResults.length === 0
                  }
                />
                <DeployStepList
                  steps={session?.steps ?? []}
                  betweenTxListAndStepper={
                    (() => {
                      const latestHash = getLatestTxHash(session?.steps ?? []);
                      return latestHash ? (
                        <a
                          href={getTxExplorerUrl(chainId, latestHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-center text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          View transaction on block explorer
                        </a>
                      ) : null;
                    })()
                  }
                />
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="btn-ghost cursor-pointer"
                >
                  Start over
                </button>
              </div>
            </>
          ) : isCompleted ? (
            <div className="mt-8 flex w-full flex-col items-center gap-8">
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold">Verification</h2>
                <p className="text-sm text-muted-foreground">All checks passed.</p>
              </div>
              <DeployVerificationResults results={verificationResults} />
              <div className="space-y-4 text-center">
                <p className="text-lg font-medium text-primary">Your community is ready!</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCompletedDismissed(true)}
                    className="btn-ghost cursor-pointer"
                  >
                    Done
                  </button>
                  {typeof session?.communityId === "number" ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/communities/${session.communityId}`)}
                      className="btn-primary cursor-pointer"
                    >
                      Go to my community
                    </button>
                  ) : null}
                </div>
              </div>
              <DeployStepList steps={session?.steps ?? []} />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Create your community</h2>
                <p className="text-sm text-muted-foreground">
                  Configure your community and follow the guided steps. You will be asked to confirm some actions from your wallet.
                </p>
                {showResume ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!canResume || isResuming}
                      onClick={() => void handleResume()}
                      className="btn-ghost cursor-pointer"
                    >
                      {isResuming ? "Resuming..." : "Resume"}
                    </button>
                  </div>
                ) : null}
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {resumeError ? <p className="text-sm text-destructive">{resumeError}</p> : null}
              </div>
              <DeployConfigSteps
                value={config}
                validationErrors={configValidation.errors}
                onChange={setConfig}
                onCreateCommunity={() => void handleStartDeploy()}
                isRunning={isRunning}
                preflight={preflight}
                runPreflight={runPreflight}
                connectedAddress={address}
                designMode={designMode}
                onDesignModeChange={setDesignMode}
                onExit={() => {
                  setWizardClosed(true);
                  setWizardExpanded(false);
                }}
              />
              <DeployStepList steps={session?.steps ?? []} />
            </>
          )}
          {!isDeploying && !isCompleted && verificationResults.length > 0 ? (
            <DeployVerificationResults results={verificationResults} />
          ) : null}
      </div>
    </div>
  );
}
