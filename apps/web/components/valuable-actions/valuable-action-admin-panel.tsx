"use client";

import Link from "next/link";
import { useState } from "react";
import { type Address, keccak256, stringToHex } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import type { ValuableActionDto } from "../../lib/graphql/queries";
import { useValuableActionAuthorityMode } from "../../hooks/useValuableActionAuthorityMode";
import { useValuableActionAdminMutations } from "../../hooks/useValuableActionAdminMutations";
import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { buildValuableActionProposalHref } from "../../lib/valuable-actions/governance";
import { ValuableActionActivationControls } from "./valuable-action-activation-controls";
import { ValuableActionForm, type ValuableActionFormValue } from "./valuable-action-form";
import { ValuableActionSubmitPreview } from "./valuable-action-submit-preview";

function extractWriteFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string" && shortMessage.trim().length > 0) {
      return shortMessage;
    }
  }

  return "Failed to propose Valuable Action.";
}

function isAccessManagedUnauthorized(error: unknown): boolean {
  const asAny = error as {
    message?: string;
    shortMessage?: string;
    cause?: {
      data?: {
        errorName?: string;
      };
      message?: string;
    };
  };

  if (asAny?.cause?.data?.errorName === "AccessManagedUnauthorized") {
    return true;
  }

  const combined = `${asAny?.message ?? ""} ${asAny?.shortMessage ?? ""} ${asAny?.cause?.message ?? ""}`.toLowerCase();
  return combined.includes("accessmanagedunauthorized") || combined.includes("unauthorized");
}

type Props = {
  communityId: number;
  action: ValuableActionDto | null;
  boundaryValid: boolean;
  isConnected: boolean;
  canCreate: boolean;
  readinessStatus?: "healthy" | "lagging" | "unavailable";
};

export function ValuableActionAdminPanel({
  communityId,
  action,
  boundaryValid,
  isConnected,
  canCreate,
  readinessStatus = "healthy",
}: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWritingCreate } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: communityId > 0 });
  const [previewPayload, setPreviewPayload] = useState<ValuableActionFormValue | null>(null);
  const [createdActionId, setCreatedActionId] = useState<number | null>(null);
  const [createGovernanceFallback, setCreateGovernanceFallback] = useState(false);
  const [createStatusMessage, setCreateStatusMessage] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const mutations = useValuableActionAdminMutations();
  const isCreateFlow = !action;

  const adminMode = useValuableActionAuthorityMode({
    operation: isCreateFlow ? "create" : "edit",
    boundaryValid,
    hasDirectWrite: isCreateFlow,
    hasGovernancePath: true,
    isConnected,
  });

  const activationMode = useValuableActionAuthorityMode({
    operation: action?.isActive ? "deactivate" : "activate",
    boundaryValid,
    hasDirectWrite: false,
    hasGovernancePath: true,
    isConnected,
  });

  const blockedReason = adminMode.mode === "blocked" ? adminMode.reasonMessage : null;
  const readinessBlocked = readinessStatus === "unavailable";
  const createBlockedByReadiness = readinessBlocked && !canCreate;
  const mutationBlocked = isCreateFlow ? createBlockedByReadiness : readinessBlocked;

  return (
    <section className="card space-y-3 p-4" aria-label="valuable-action-admin-panel">
      <h3 className="text-lg font-semibold">{isCreateFlow ? "Create Valuable Action" : "Admin"}</h3>
      {blockedReason ? <p className="text-sm text-red-600">{blockedReason}</p> : null}
      {mutationBlocked ? (
        <p className="text-sm text-amber-600">Projection unavailable. Mutations are gated until readiness recovers.</p>
      ) : null}
      {adminMode.mode === "governance_required" ? (
        <p className="text-xs text-muted-foreground">
          Changes are executed through governance proposals. Evidence spec is pinned to IPFS automatically when you submit.
        </p>
      ) : null}
      {isCreateFlow ? (
        <p className="text-xs text-muted-foreground">
          Flow: 1) propose the Valuable Action on-chain, 2) create activation proposal.
        </p>
      ) : null}

      <ValuableActionForm
        initialValue={{
          title: action?.title ?? "",
          metadataCid: action?.evidenceSpecCid ?? "",
          ruleSummary: "",
        }}
        onSubmit={async (payload) => {
          if (mutationBlocked) return;
          setPreviewPayload(payload);
          setCreateGovernanceFallback(false);
          setCreateErrorMessage(null);
          setCreateStatusMessage(null);

          const basePayload = {
            communityId,
            title: payload.title,
            metadataCid: payload.metadataCid,
            ruleSummary: payload.ruleSummary,
            category: payload.category,
            verifierPolicy: payload.verifierPolicy,
            membershipTokenReward: payload.membershipTokenReward,
            communityTokenReward: payload.communityTokenReward,
            jurorsMin: payload.jurorsMin,
            panelSize: payload.panelSize,
            verifyWindow: payload.verifyWindow,
            cooldownPeriod: payload.cooldownPeriod,
            revocable: payload.revocable,
            proposalThreshold: payload.proposalThreshold,
            titleTemplate: payload.title,
          } as const;

          if (isCreateFlow) {
            try {
              if (!modules?.valuableActionRegistry) {
                throw new Error("ValuableActionRegistry module is not registered for this community.");
              }
              if (!publicClient) {
                throw new Error("Public client unavailable for transaction confirmation.");
              }

              const result = await mutations.create.mutateAsync({
                mode: "direct_write",
                payload: basePayload,
              });

              if (!result.contractPayload) {
                throw new Error("Unable to build Valuable Action contract payload.");
              }

              if (!address) {
                throw new Error("Connect a wallet to continue.");
              }

              const proposalRef = keccak256(
                stringToHex(
                  `${communityId}:${payload.title.trim()}:${payload.metadataCid.trim()}:${Date.now()}`
                )
              );

              try {
                await publicClient.simulateContract({
                  address: modules.valuableActionRegistry,
                  abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
                  functionName: "proposeValuableAction",
                  args: [result.contractPayload, proposalRef],
                  account: address as Address,
                });
              } catch (simulationError) {
                if (isAccessManagedUnauthorized(simulationError)) {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(
                      `va-proposal-draft:${communityId}`,
                      JSON.stringify(basePayload)
                    );
                  }
                  setCreateGovernanceFallback(true);
                  setCreateStatusMessage("Direct write is not authorized for this wallet. Continue via governance proposal.");
                  return;
                }
                throw simulationError;
              }

              const lastIdBefore = await publicClient.readContract({
                address: modules.valuableActionRegistry,
                abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
                functionName: "lastId",
              });

              const txHash = await writeContractAsync({
                address: modules.valuableActionRegistry,
                abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
                functionName: "proposeValuableAction",
                args: [result.contractPayload, proposalRef],
              });

              await publicClient.waitForTransactionReceipt({ hash: txHash });

              const lastIdAfter = await publicClient.readContract({
                address: modules.valuableActionRegistry,
                abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
                functionName: "lastId",
              });

              const normalizedBefore = typeof lastIdBefore === "bigint" ? lastIdBefore : BigInt(lastIdBefore as number);
              const normalizedAfter = typeof lastIdAfter === "bigint" ? lastIdAfter : BigInt(lastIdAfter as number);
              const resolvedActionId = Number(normalizedAfter > normalizedBefore ? normalizedAfter : normalizedBefore);
              setCreatedActionId(Number.isFinite(resolvedActionId) && resolvedActionId > 0 ? resolvedActionId : null);
              setCreateStatusMessage("Valuable Action proposed on-chain. Continue with activation proposal.");
            } catch (error) {
              setCreateErrorMessage(extractWriteFailureMessage(error));
            }
            return;
          }

          void mutations.edit.mutateAsync({
            mode: adminMode.mode,
            payload: {
              actionId: action?.actionId,
              ...basePayload,
            },
          });
        }}
      />

      {previewPayload ? <ValuableActionSubmitPreview payload={previewPayload} /> : null}

      {isCreateFlow && createStatusMessage ? <p className="text-xs text-emerald-600">{createStatusMessage}</p> : null}
      {isCreateFlow && createErrorMessage ? <p className="text-xs text-destructive">{createErrorMessage}</p> : null}
      {isCreateFlow && createdActionId ? (
        <Link
          className="btn-primary"
          href={buildValuableActionProposalHref({
            communityId,
            operation: "activate",
            actionId: createdActionId,
            nextActive: true,
          })}
        >
          Create activation proposal
        </Link>
      ) : null}
      {isCreateFlow && createGovernanceFallback ? (
        <Link
          className="btn-outline"
          href={buildValuableActionProposalHref({ communityId, operation: "create" })}
        >
          Open governance proposal builder
        </Link>
      ) : null}

      <ValuableActionActivationControls
        communityId={communityId}
        actionId={action?.actionId}
        isActive={Boolean(action?.isActive)}
        mode={readinessBlocked ? "blocked" : activationMode.mode}
        onToggle={() => {
          if (readinessBlocked) return;
          void mutations.toggleActivation.mutateAsync({
            mode: activationMode.mode,
            payload: {
              communityId,
              actionId: action?.actionId,
              active: !action?.isActive,
            },
          });
        }}
      />

      {mutations.toggleActivation.isPending ? (
        <p className="text-xs text-muted-foreground">Waiting for projection confirmation...</p>
      ) : null}
      {mutations.toggleActivation.data ? (
        <p className="text-xs text-muted-foreground">{mutations.toggleActivation.data.message}</p>
      ) : null}
      {isCreateFlow && isWritingCreate ? (
        <p className="text-xs text-muted-foreground">Submitting Valuable Action transaction...</p>
      ) : null}
    </section>
  );
}
