"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";

import {
  createDefaultDeploymentConfig,
  validateDeploymentConfig,
  type CommunityDeploymentConfig
} from "../../lib/deploy/config";
import { useDeployResume } from "../../hooks/useDeployResume";
import { useDeployWizard, type UseDeployWizardOptions } from "../../hooks/useDeployWizard";
import { DeployConfigForm } from "./deploy-config-form";
import { DeployPreflight } from "./deploy-preflight";
import { DeployStepList } from "./deploy-step-list";
import { DeployVerificationResults } from "./deploy-verification-results";

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
    preflight,
    verificationResults,
    resumeCandidate,
    error,
    isRunning,
    runPreflight,
    run,
    setSession
  } = useDeployWizard(options);
  const { resume, error: resumeError } = useDeployResume();
  const [config, setConfig] = useState<CommunityDeploymentConfig>(() => createDefaultDeploymentConfig());
  const [isResuming, setIsResuming] = useState(false);
  const resumeRequestIdRef = useRef(0);

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

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager Home</p>
        <h2 className="text-2xl font-semibold">Community Deploy Wizard</h2>
        <p className="text-sm text-muted-foreground">
          This guided flow executes a multi-signature sequence: preflight, deploy stack, role wiring, and deterministic verification.
          Shared infrastructure must already exist and each transaction is signed by your connected wallet.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isRunning}
          onClick={() => void runPreflight()}
          className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Run preflight
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => void handleStartDeploy()}
          className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Start deploy
        </button>
        <button
          type="button"
          disabled={!canResume || isResuming}
          onClick={() => void handleResume()}
          className="rounded border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isResuming ? "Resuming..." : "Resume deploy"}
        </button>
      </div>

      {!canStart ? (
        <p className="text-sm text-destructive">
          Connect a wallet and complete valid deployment configuration before starting.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {resumeError ? <p className="text-sm text-destructive">{resumeError}</p> : null}

      <DeployConfigForm
        value={config}
        deployerAddress={address}
        validationErrors={configValidation.errors}
        onChange={setConfig}
      />
      <DeployPreflight assessment={preflight} />
      <DeployStepList steps={session?.steps ?? []} />
      <DeployVerificationResults results={verificationResults} />

      {session?.status ? (
        <p className="text-xs text-muted-foreground">Session status: {session.status}</p>
      ) : null}
    </section>
  );
}
