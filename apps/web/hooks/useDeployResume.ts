"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseAbiItem } from "viem";
import { getContractAddress } from "../lib/contracts";
import { findResumeCandidate, listSessions, saveSession } from "../lib/deploy/session-store";
import type { DeploymentWizardSession, VerificationSnapshot } from "../lib/deploy/types";
import type { CommunityDeploymentConfig } from "../lib/deploy/config";
import { readVerificationSnapshot as readVerificationSnapshotFromChain } from "../lib/deploy/onchain";
import { evaluateVerificationSnapshot } from "../lib/deploy/verification";
import { createInitialSteps, firstIncompleteStep, transitionStep } from "../lib/deploy/wizard-machine";
import { useCachedPublicClient, type CachedPublicClient } from "./useCachedPublicClient";

export type ResumeTarget = {
  sessionId?: string;
  communityId?: number;
};

export type OnchainResumeReader = (
  communityId: number,
  chainId: number
) => Promise<VerificationSnapshot>;

export type CommunityIdRecoveryReader = (
  deployerAddress: `0x${string}`,
  chainId: number,
  targetCommunityId?: number
) => Promise<number | number[] | null>;

export type DeploymentConfigRecoveryReader = (
  communityId: number,
  chainId: number
) => Promise<CommunityDeploymentConfig | null>;

const COMMUNITY_REGISTERED_EVENT = parseAbiItem(
  "event CommunityRegistered(uint256 indexed communityId, string name, address indexed creator, uint256 parentCommunityId)"
);

const RESUME_LOG_PREFIX = "[DeployResume]";

function log(message: string, meta?: unknown): void {
  if (meta === undefined) {
    console.log(`${RESUME_LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${RESUME_LOG_PREFIX} ${message}`, meta);
}

const GET_COMMUNITY_ITEM = parseAbiItem(
  "function getCommunity(uint256 communityId) view returns ((string name,string description,string metadataURI,address governor,address timelock,address membershipToken,address communityToken,address requestHub,address draftsManager,address engagementsManager,address verifierElection,address verifierManager,address verifierPowerToken,address valuableActionRegistry,address valuableActionSBT,address treasuryVault,address treasuryAdapter,address paramController,uint256 parentCommunityId,uint256[] allyCommunityIds))"
);

const GET_ECONOMIC_PARAMETERS_ITEM = parseAbiItem(
  "function getEconomicParameters(uint256 communityId) view returns (uint256 minTreasuryBps, uint256 minPositionsBps, uint256 feeOnWithdraw, address[] backingAssets)"
);

async function inferCommunityIdsFromChain(params: {
  publicClient: CachedPublicClient;
  deployerAddress: `0x${string}`;
  chainId: number;
  targetCommunityId?: number;
}): Promise<number[]> {
  const { publicClient, deployerAddress, chainId, targetCommunityId } = params;

  if (typeof targetCommunityId === "number") return [targetCommunityId];
  if (!publicClient.raw) return [];

  const toBlock = await publicClient.getBlockNumber(5_000);
  const fromBlock = toBlock > 500_000n ? toBlock - 500_000n : 0n;

  const logs = await publicClient.getLogs({
    address: getContractAddress("communityRegistry", chainId),
    event: COMMUNITY_REGISTERED_EVENT,
    args: { creator: deployerAddress },
    fromBlock,
    toBlock
  }, 30_000);

  if (logs.length === 0) return [];

  // Newest first, deduplicated.
  const ids: number[] = [];
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const communityId = logs[i]?.args?.communityId;
    if (typeof communityId !== "bigint") continue;
    const numericId = Number(communityId);
    if (!ids.includes(numericId)) ids.push(numericId);
  }
  return ids;
}

function normalizeRecoveredIds(
  recovered: number | number[] | null,
  targetCommunityId?: number
): number[] {
  if (typeof targetCommunityId === "number") return [targetCommunityId];
  if (typeof recovered === "number") return [recovered];
  if (Array.isArray(recovered)) return recovered;
  return [];
}

function buildRecoveredRegisteredSession(params: {
  deployerAddress: `0x${string}`;
  chainId: number;
  communityId: number;
}): DeploymentWizardSession {
  let steps = createInitialSteps();
  steps = transitionStep(steps, "PRECHECKS", "succeeded");
  // Recovery from CommunityRegistered log only proves registration happened,
  // not that the rest of DEPLOY_STACK completed. Force resume from DEPLOY_STACK.
  steps = transitionStep(steps, "DEPLOY_STACK", "failed", {
    failureReason: "Recovered from on-chain registration event. Resume from Deploy Community Stack.",
    nextActionHint: "Use Start deploy to continue from Deploy Community Stack."
  });

  const previousConfig = listSessions().find(
    (session) =>
      session.deployerAddress.toLowerCase() === params.deployerAddress.toLowerCase() &&
      session.chainId === params.chainId &&
      session.deploymentConfig
  )?.deploymentConfig;

  const now = new Date().toISOString();
  return {
    sessionId: `${params.deployerAddress.toLowerCase()}-recovered-${params.communityId}`,
    deployerAddress: params.deployerAddress,
    chainId: params.chainId,
    communityId: params.communityId,
    deploymentConfig: previousConfig,
    targetType: "registered",
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
    steps
  };
}

function normalizeAddress(value?: string): string {
  if (!value) return "";
  return value.toLowerCase() === "0x0000000000000000000000000000000000000000" ? "" : value;
}

async function recoverDeploymentConfigFromChain(
  publicClient: CachedPublicClient,
  chainId: number,
  communityId: number
): Promise<CommunityDeploymentConfig | null> {
  if (!publicClient.raw) return null;

  try {
    const registry = getContractAddress("communityRegistry", chainId);

    const community = (await publicClient.readContract({
      address: registry,
      abi: [GET_COMMUNITY_ITEM],
      functionName: "getCommunity",
      args: [BigInt(communityId)]
    }, 20_000)) as {
      name: string;
      description: string;
      metadataURI: string;
      treasuryVault: `0x${string}`;
    };

    const economic = (await publicClient.readContract({
      address: registry,
      abi: [GET_ECONOMIC_PARAMETERS_ITEM],
      functionName: "getEconomicParameters",
      args: [BigInt(communityId)]
    }, 20_000)) as readonly [bigint, bigint, bigint, readonly `0x${string}`[]];

    const backingAssets = (economic[3] ?? []).map((token) => normalizeAddress(token)).filter(Boolean);

    return {
      communityName: community.name ?? "",
      communityDescription: community.description ?? "",
      communityMetadataUri: community.metadataURI ?? "",
      treasuryVault: normalizeAddress(community.treasuryVault),
      treasuryStableToken: backingAssets[0] ?? "",
      supportedTokensCsv: backingAssets.join(",")
    };
  } catch (error) {
    log("On-chain deployment config hydration failed", {
      communityId,
      error
    });
    return null;
  }
}

export function useDeployResume(
  readOnchainSnapshot?: OnchainResumeReader,
  recoverCommunityId?: CommunityIdRecoveryReader,
  recoverDeploymentConfig?: DeploymentConfigRecoveryReader
) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = useCachedPublicClient();
  const [error, setError] = useState<string | null>(null);

  const candidate = useMemo(() => {
    if (!address) return null;
    return findResumeCandidate(address, chainId);
  }, [address, chainId]);

  const resume = useCallback(
    async (target?: ResumeTarget): Promise<DeploymentWizardSession | null> => {
      setError(null);
      log("Resume requested", {
        target,
        connectedAddress: address,
        chainId
      });

      if (!address) {
        log("Resume blocked: wallet not connected");
        setError("Connect wallet to resume deployment.");
        return null;
      }

      let session = findResumeCandidate(address, chainId, target?.communityId);
      log("Local resume candidate lookup", {
        found: Boolean(session),
        sessionId: session?.sessionId,
        communityId: session?.communityId,
        status: session?.status
      });

      if (!session) {
        const recoveredIds = recoverCommunityId
          ? normalizeRecoveredIds(
              await recoverCommunityId(address, chainId, target?.communityId),
              target?.communityId
            )
          : await inferCommunityIdsFromChain({
              publicClient,
              deployerAddress: address,
              chainId,
              targetCommunityId: target?.communityId
            });

        log("Recovered candidate community IDs from chain", {
          recoveredIds
        });

        let recoveredCommunityId: number | null = null;
        for (const candidateCommunityId of recoveredIds) {
          log("Evaluating recovered community", {
            candidateCommunityId
          });

          const snapshot = readOnchainSnapshot
            ? await readOnchainSnapshot(candidateCommunityId, chainId)
            : publicClient.raw
              ? await readVerificationSnapshotFromChain(
                  publicClient.raw,
                  chainId,
                  candidateCommunityId,
                  session?.deploymentAddresses
                )
              : null;

          if (!snapshot) {
            log("Skipping recovered community: no snapshot available", {
              candidateCommunityId
            });
            continue;
          }

          const checks = evaluateVerificationSnapshot(snapshot);
          const allPassed = checks.every((check) => check.passed);

          log("Recovered community verification result", {
            candidateCommunityId,
            allPassed,
            failedChecks: checks.filter((check) => !check.passed).map((check) => check.key)
          });

          if (!allPassed) {
            recoveredCommunityId = candidateCommunityId;
            log("Selected recovered community for resume", {
              recoveredCommunityId
            });
            break;
          }
        }

        if (typeof recoveredCommunityId === "number") {
          session = buildRecoveredRegisteredSession({
            deployerAddress: address,
            chainId,
            communityId: recoveredCommunityId
          });
          saveSession(session);
          log("Recovered session created", {
            sessionId: session.sessionId,
            communityId: session.communityId
          });
        } else {
          log("Resume aborted: no unfinished deployment found after recovery scan");
          setError("No unfinished deployment found for this wallet.");
          return null;
        }
      }

      if (session.deployerAddress.toLowerCase() !== address.toLowerCase()) {
        log("Resume blocked: deployer mismatch", {
          sessionDeployer: session.deployerAddress,
          connectedAddress: address
        });
        setError("Only the initiating deployer wallet can resume this deployment.");
        return null;
      }

      const deploymentConfig = session.deploymentConfig ??
        (session.communityId
          ? recoverDeploymentConfig
            ? await recoverDeploymentConfig(session.communityId, chainId)
            : await recoverDeploymentConfigFromChain(publicClient, chainId, session.communityId)
          : null);

      log("Deployment config hydration", {
        source: session.deploymentConfig
          ? "session"
          : session.communityId
            ? recoverDeploymentConfig
              ? "custom-recovery"
              : "onchain"
            : "none",
        hasConfig: Boolean(deploymentConfig),
        communityId: session.communityId
      });

      if (session.communityId && readOnchainSnapshot) {
        const snapshot = await readOnchainSnapshot(session.communityId, chainId);
        const checks = evaluateVerificationSnapshot(snapshot);
        const allPassed = checks.every((check) => check.passed);

        const updated: DeploymentWizardSession = {
          ...session,
          deploymentConfig: deploymentConfig ?? session.deploymentConfig,
          status: allPassed ? "completed" : "in-progress",
          targetType: "registered",
          updatedAt: new Date().toISOString()
        };
        saveSession(updated);
        log("Resume resolved using custom snapshot reader", {
          sessionId: updated.sessionId,
          communityId: updated.communityId,
          status: updated.status
        });
        return updated;
      }

      if (session.communityId && !readOnchainSnapshot) {
        if (publicClient.raw) {
          const snapshot = await readVerificationSnapshotFromChain(
            publicClient.raw,
            chainId,
            session.communityId,
            session.deploymentAddresses
          );
          const checks = evaluateVerificationSnapshot({
            ...snapshot
          });
          const allPassed = checks.every((check) => check.passed);
          const updated: DeploymentWizardSession = {
            ...session,
            deploymentConfig: deploymentConfig ?? session.deploymentConfig,
            status: allPassed ? "completed" : "in-progress",
            targetType: "registered",
            updatedAt: new Date().toISOString()
          };
          saveSession(updated);
          log("Resume resolved using on-chain snapshot reader", {
            sessionId: updated.sessionId,
            communityId: updated.communityId,
            status: updated.status
          });
          return updated;
        }
      }

      const next = firstIncompleteStep(session.steps);
      const updated: DeploymentWizardSession = {
        ...session,
        deploymentConfig: deploymentConfig ?? session.deploymentConfig,
        status: "in-progress",
        lastError: undefined,
        updatedAt: new Date().toISOString(),
        steps: session.steps.map((step) =>
          step.key === next && step.status === "failed"
            ? { ...step, status: "pending", failureReason: undefined, nextActionHint: undefined }
            : step
        )
      };

      saveSession(updated);
      log("Resume resolved from local session steps", {
        sessionId: updated.sessionId,
        communityId: updated.communityId,
        status: updated.status,
        nextStep: firstIncompleteStep(updated.steps)
      });
      return updated;
    },
    [address, chainId, publicClient, readOnchainSnapshot, recoverCommunityId, recoverDeploymentConfig]
  );

  return {
    candidate,
    error,
    resume
  };
}
