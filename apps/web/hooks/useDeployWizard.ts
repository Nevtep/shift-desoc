"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import {
  type CommunityDeploymentConfig,
  validateDeploymentConfig
} from "../lib/deploy/config";
import {
  createDefaultUserSignedStepExecutor,
  type StepExecutionResult,
  type StepExecutor
} from "../lib/deploy/default-step-executor";
import {
  buildPreflightAssessment,
  estimateFunding,
  probeSharedInfra,
  type FundsEstimateInput
} from "../lib/deploy/preflight";
import { readVerificationSnapshot as readVerificationSnapshotFromChain } from "../lib/deploy/onchain";
import { findResumeCandidate, saveSession } from "../lib/deploy/session-store";
import type { DeploymentWizardSession, PreflightAssessment, StepKey, VerificationCheckResult } from "../lib/deploy/types";
import {
  createInitialSession,
  isCreatedState,
  nextRunnableStep,
  recordStepTx,
  transitionStep
} from "../lib/deploy/wizard-machine";
import { allVerificationChecksPassed, evaluateVerificationSnapshot } from "../lib/deploy/verification";

export type VerificationSnapshotReader = (
  communityId: number,
  chainId: number
) => Promise<{
  modules: { valuableActionRegistryMatches: boolean };
  vptInitialized: boolean;
  roles: {
    rrPositionManager: boolean;
    rrDistributor: boolean;
    commerceDisputesCaller: boolean;
    housingMarketplaceCaller: boolean;
    vaIssuerRequestHub: boolean;
  };
  marketplaceActive: boolean;
  revenueTreasurySet: boolean;
}>;

export type UseDeployWizardOptions = {
  supportedChainIds?: number[];
  estimateInput?: Partial<FundsEstimateInput>;
  stepExecutor?: StepExecutor;
  readVerificationSnapshot?: VerificationSnapshotReader;
};

const DEFAULT_SUPPORTED_CHAIN_IDS = [84532];
const DEPLOY_LOG_PREFIX = "[DeployWizard]";

function log(message: string, meta?: unknown): void {
  if (meta === undefined) {
    console.log(`${DEPLOY_LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${DEPLOY_LOG_PREFIX} ${message}`, meta);
}

export function useDeployWizard(options: UseDeployWizardOptions = {}) {
  const supportedChainIds = options.supportedChainIds ?? DEFAULT_SUPPORTED_CHAIN_IDS;
  const estimateInput = options.estimateInput;
  const { status, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [session, setSession] = useState<DeploymentWizardSession | null>(null);
  const [preflight, setPreflight] = useState<PreflightAssessment | null>(null);
  const [verificationResults, setVerificationResults] = useState<VerificationCheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const hasAutoPreflightRun = useRef(false);
  const runInFlightRef = useRef(false);

  const createSession = useCallback(() => {
    if (!address) return null;
    const initial = createInitialSession(address, chainId);
    log("Created deployment session", {
      sessionId: initial.sessionId,
      deployerAddress: initial.deployerAddress,
      chainId: initial.chainId
    });
    setSession(initial);
    saveSession(initial);
    return initial;
  }, [address, chainId]);

  const runPreflight = useCallback(async () => {
    if (!publicClient) {
      log("Skipping preflight: publicClient not available yet");
      return null;
    }

    log("Starting preflight", {
      chainId,
      connectedAddress: address,
      status,
      supportedChainIds
    });

    const connected = status === "connected" && Boolean(address);
    const sharedInfra = await probeSharedInfra(publicClient, chainId);
    const currentBalanceWei = connected && address ? await publicClient.getBalance({ address }) : 0n;
    const funding = estimateFunding({
      estimatedTxCount: estimateInput?.estimatedTxCount ?? 20,
      estimatedGasPerTx: estimateInput?.estimatedGasPerTx ?? 250000n,
      maxFeePerGasWei: estimateInput?.maxFeePerGasWei ?? 2_000_000_000n,
      currentBalanceWei,
      bufferMultiplierBps: estimateInput?.bufferMultiplierBps ?? 12500
    });

    const assessment = buildPreflightAssessment({
      walletConnected: connected,
      connectedAddress: address,
      chainId,
      supportedChainIds,
      sharedInfra,
      funding
    });

    setPreflight(assessment);
    log("Preflight completed", {
      walletConnected: assessment.walletConnected,
      supportedNetwork: assessment.supportedNetwork,
      sharedInfraUsable: assessment.sharedInfra.isUsable,
      fundsSufficient: assessment.funding.isSufficient,
      blockingReasons: assessment.blockingReasons
    });
    return assessment;
  }, [address, chainId, estimateInput, publicClient, status, supportedChainIds]);

  useEffect(() => {
    if (hasAutoPreflightRun.current) return;
    if (!publicClient) return;

    hasAutoPreflightRun.current = true;
    log("Running one-time auto preflight check");
    void runPreflight();
  }, [publicClient, runPreflight]);

  const runVerification = useCallback(
    async (activeSession: DeploymentWizardSession) => {
      if (!activeSession.communityId || !publicClient) {
        log("Skipping verification: missing communityId or publicClient", {
          communityId: activeSession.communityId,
          hasPublicClient: Boolean(publicClient)
        });
        return [];
      }

      log("Starting verification checks", {
        communityId: activeSession.communityId,
        chainId
      });

      const reader =
        options.readVerificationSnapshot ??
        (async (communityId: number, currentChainId: number) =>
          readVerificationSnapshotFromChain(publicClient, currentChainId, communityId));
      const snapshot = await reader(activeSession.communityId, chainId);
      const results = evaluateVerificationSnapshot({
        communityId: activeSession.communityId,
        ...snapshot
      });
      setVerificationResults(results);
      log("Verification checks completed", {
        totalChecks: results.length,
        passedChecks: results.filter((result) => result.passed).length,
        failedKeys: results.filter((result) => !result.passed).map((result) => result.key)
      });
      return results;
    },
    [chainId, options, publicClient]
  );

  const run = useCallback(async (config: CommunityDeploymentConfig, resumeSession?: DeploymentWizardSession) => {
    if (runInFlightRef.current) {
      setError("A deployment run is already in progress. Wait for it to finish.");
      log("Start deploy ignored: run already in progress");
      return;
    }

    runInFlightRef.current = true;
    setIsRunning(true);
    setError(null);
    try {
      if (!resumeSession) {
        // A manual Start deploy is always a fresh attempt from PRECHECKS.
        setVerificationResults([]);
      }
      log("Start deploy requested", {
        chainId,
        hasCustomExecutor: Boolean(options.stepExecutor),
        communityName: config.communityName
      });

      const validation = validateDeploymentConfig(config);
      if (!validation.isValid) {
        log("Deployment config validation failed", {
          errors: validation.errors
        });
        setError("Complete required deployment configuration before starting deployment.");
        return;
      }

      log("Deployment config validation passed");

      const assessment = await runPreflight();
      if (!assessment) {
        log("Stopping deploy: preflight did not return an assessment");
        return;
      }

      const initial = resumeSession ?? createSession();
      if (!initial) {
        log("Stopping deploy: no connected wallet session available");
        setError("Connect wallet to start deployment.");
        return;
      }
      let active: DeploymentWizardSession = {
        ...initial,
        deploymentConfig: { ...config },
        updatedAt: new Date().toISOString()
      };
      setSession(active);
      saveSession(active);

      if (assessment.blockingReasons.length > 0) {
        log("Stopping deploy: preflight is blocked", {
          blockingReasons: assessment.blockingReasons
        });
        const blocked: DeploymentWizardSession = {
          ...active,
          status: "preflight-blocked",
          updatedAt: new Date().toISOString()
        };
        setSession(blocked);
        saveSession(blocked);
        return;
      }

      if (!publicClient) {
        setError("Public client unavailable. Reconnect wallet and retry.");
        return;
      }

      const execute =
        options.stepExecutor ??
        createDefaultUserSignedStepExecutor({
          publicClient,
          writeContractAsync: writeContractAsync as any,
          connectedAddress: address
        });
      log("Executor selected", {
        mode: options.stepExecutor ? "custom" : "default"
      });

      let nextStep = nextRunnableStep(active.steps);
      while (nextStep) {
      const runningStep = nextStep;
      try {
        log("Step starting", {
          step: runningStep,
          sessionId: active.sessionId
        });
        active = {
          ...active,
          status: "in-progress",
          steps: transitionStep(active.steps, runningStep, "running"),
          updatedAt: new Date().toISOString()
        };
        setSession(active);
        saveSession(active);

        const result = await execute(runningStep, active, {
          config,
          chainId,
          preflight: assessment
        });
        log("Step execution returned", {
          step: runningStep,
          txHashes: result.txHashes ?? [],
          communityId: result.communityId
        });
        for (const txHash of result.txHashes ?? []) {
          log("Recording tx hash", {
            step: runningStep,
            txHash
          });
          active = {
            ...active,
            steps: recordStepTx(active.steps, runningStep, txHash)
          };
        }
        if (typeof result.communityId === "number") {
          active = {
            ...active,
            communityId: result.communityId,
            targetType: "registered"
          };
        }

        const nextStatus =
          runningStep === "VERIFY_DEPLOYMENT"
            ? allVerificationChecksPassed(await runVerification(active))
              ? "succeeded"
              : "failed"
            : "succeeded";

        log("Step status resolved", {
          step: runningStep,
          status: nextStatus
        });

        active = {
          ...active,
          steps: transitionStep(active.steps, runningStep, nextStatus),
          status: nextStatus === "failed" ? "failed" : active.status,
          updatedAt: new Date().toISOString()
        };

        if (nextStatus === "failed") {
          log("Stopping deploy: step failed", {
            step: runningStep
          });
          setSession(active);
          saveSession(active);
          return;
        }

        nextStep = nextRunnableStep(active.steps);
        log("Next runnable step evaluated", {
          nextStep
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown deployment error";
        console.log(`${DEPLOY_LOG_PREFIX} Step execution threw`, {
          step: runningStep,
          message,
          error: err
        });
        active = {
          ...active,
          status: "failed",
          steps: transitionStep(active.steps, runningStep, "failed", {
            failureReason: message,
            nextActionHint: "Fix the issue and use Resume deploy."
          }),
          lastError: { code: "STEP_FAILURE", message, stepKey: runningStep },
          updatedAt: new Date().toISOString()
        };
        setError(message);
        setSession(active);
        saveSession(active);
        return;
      }
      }

      const completed: DeploymentWizardSession = {
        ...active,
        status: isCreatedState(active) ? "completed" : "failed",
        updatedAt: new Date().toISOString()
      };
      log("Deploy flow finished", {
        finalStatus: completed.status,
        communityId: completed.communityId,
        sessionId: completed.sessionId
      });
      setSession(completed);
      saveSession(completed);
    } finally {
      runInFlightRef.current = false;
      setIsRunning(false);
    }
  }, [address, chainId, createSession, options, publicClient, runPreflight, runVerification, writeContractAsync]);

  const resumeCandidate = useMemo(() => {
    if (!address) return null;
    return findResumeCandidate(address, chainId);
  }, [address, chainId]);

  return {
    session,
    preflight,
    verificationResults,
    resumeCandidate,
    error,
    isRunning,
    runPreflight,
    run,
    setSession
  };
}
