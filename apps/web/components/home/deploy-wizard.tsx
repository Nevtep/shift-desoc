"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";

import Link from "next/link";

import {
  createDefaultDeploymentConfig,
  validateDeploymentConfig,
  type CommunityDeploymentConfig
} from "../../lib/deploy/config";
import { useDeployResume } from "../../hooks/useDeployResume";
import { useDeployWizard, type UseDeployWizardOptions } from "../../hooks/useDeployWizard";
import { DeployConfigSteps } from "./deploy-config-steps";
import { DeployStepList } from "./deploy-step-list";
import { DeployVerificationResults } from "./deploy-verification-results";
import { OnboardingConnectStep } from "./onboarding-connect-step";

type Props = {
  options?: UseDeployWizardOptions;
};

const FORM_DRAFT_STORAGE_KEY = "shift.manager.deploy.formDraft.v1";

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
  const { status, address } = useAccount();
  const chainId = useChainId();
  const {
    session,
    verificationResults,
    resumeCandidate,
    error,
    isRunning,
    run,
    setSession
  } = useDeployWizard(options);
  const { resume, error: resumeError } = useDeployResume();
  const [config, setConfig] = useState<CommunityDeploymentConfig>(() => createDefaultDeploymentConfig());
  const [isResuming, setIsResuming] = useState(false);
  const [completedDismissed, setCompletedDismissed] = useState(false);
  const resumeRequestIdRef = useRef(0);

  const isCompleted = session?.status === "completed";
  const showFullScreen = !isCompleted || !completedDismissed;

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

  if (!showFullScreen) {
    return (
      <section className="space-y-6">
        <p className="text-sm font-medium text-emerald-600">Your community is ready!</p>
        <Link href="/" className="btn-primary cursor-pointer">
          Go to home
        </Link>
      </section>
    );
  }

  if (status !== "connected") {
    return <OnboardingConnectStep fullScreen hideCloseButton />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/contact-bg.webp)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center gap-6">
            <img
              src="/imagotipo-h.svg"
              alt="Shift DeSoc"
              className="h-16 w-auto sm:h-20"
            />
          </div>
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
          />
          <DeployStepList steps={session?.steps ?? []} />
          <DeployVerificationResults results={verificationResults} />

          {isCompleted ? (
            <div className="space-y-4 text-center">
              <p className="text-lg font-medium text-emerald-600">Your community is ready!</p>
              <button
                type="button"
                onClick={() => setCompletedDismissed(true)}
                className="btn-primary cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : null}
      </div>
    </div>
  );
}
