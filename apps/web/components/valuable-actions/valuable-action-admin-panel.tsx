"use client";

import Link from "next/link";
import { useState } from "react";
import { type Address, keccak256, stringToHex } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import type { ValuableActionDto } from "../../lib/graphql/queries";
import {
  useValuableActionAuthorityMode,
  useValuableActionDirectWriteAuthority,
} from "../../hooks/useValuableActionAuthorityMode";
import {
  useValuableActionAdminMutations,
  type ValuableActionMutationPayload,
} from "../../hooks/useValuableActionAdminMutations";
import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import {
  buildDraftPersistenceSuffix,
  buildGovernanceFallbackMessage,
} from "../../lib/valuable-actions/authority-messages";
import { extractCreatedActionIdFromReceipt } from "../../lib/valuable-actions/created-action-id";
import { persistGovernanceDraft } from "../../lib/valuable-actions/draft-persistence";
import {
  buildValuableActionCreateDraftKey,
  buildValuableActionEditDraftKey,
  buildValuableActionProposalHref,
} from "../../lib/valuable-actions/governance";
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

  return "Failed to submit Valuable Action transaction.";
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
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: communityId > 0 });
  const [previewPayload, setPreviewPayload] = useState<ValuableActionFormValue | null>(null);
  const [createdActionId, setCreatedActionId] = useState<number | null>(null);
  const [createGovernanceCta, setCreateGovernanceCta] = useState(false);
  const [editGovernanceCta, setEditGovernanceCta] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activationStatusMessage, setActivationStatusMessage] = useState<string | null>(null);
  const [activationErrorMessage, setActivationErrorMessage] = useState<string | null>(null);
  const [isTogglingActivation, setIsTogglingActivation] = useState(false);
  const mutations = useValuableActionAdminMutations();
  const isCreateFlow = !action;

  const authorityCheckEnabled = boundaryValid && isConnected && communityId > 0;

  const adminAuthority = useValuableActionDirectWriteAuthority({
    operation: isCreateFlow ? "create" : "edit",
    walletAddress: address,
    registryAddress: modules?.valuableActionRegistry,
    accessManagerAddress: modules?.accessManager,
    publicClient,
    enabled: authorityCheckEnabled,
  });

  const activationAuthority = useValuableActionDirectWriteAuthority({
    operation: action?.isActive ? "deactivate" : "activate",
    walletAddress: address,
    registryAddress: modules?.valuableActionRegistry,
    accessManagerAddress: modules?.accessManager,
    publicClient,
    enabled: authorityCheckEnabled && !isCreateFlow,
  });

  const adminMode = useValuableActionAuthorityMode({
    operation: isCreateFlow ? "create" : "edit",
    boundaryValid,
    hasDirectWrite: adminAuthority.hasDirectWrite,
    hasGovernancePath: true,
    isConnected,
  });

  const activationMode = useValuableActionAuthorityMode({
    operation: action?.isActive ? "deactivate" : "activate",
    boundaryValid,
    hasDirectWrite: activationAuthority.hasDirectWrite,
    hasGovernancePath: true,
    isConnected,
  });

  const blockedReason = adminMode.mode === "blocked" ? adminMode.reasonMessage : null;
  const readinessBlocked = readinessStatus === "unavailable";
  const createBlockedByReadiness = readinessBlocked && !canCreate;
  const mutationBlocked = isCreateFlow ? createBlockedByReadiness : readinessBlocked;

  async function submitDirectRegistryWrite(args: {
    functionName: "proposeValuableAction" | "update";
    args: readonly unknown[];
  }) {
    if (!modules?.valuableActionRegistry) {
      throw new Error("ValuableActionRegistry module is not registered for this community.");
    }
    if (!publicClient) {
      throw new Error("Public client unavailable for transaction confirmation.");
    }
    if (!address) {
      throw new Error("Connect a wallet to continue.");
    }

    await publicClient.simulateContract({
      address: modules.valuableActionRegistry,
      abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
      functionName: args.functionName,
      args: args.args,
      account: address as Address,
    });

    const txHash = await writeContractAsync({
      address: modules.valuableActionRegistry,
      abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
      functionName: args.functionName,
      args: args.args,
    });

    return publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  async function handleCreateSubmit(basePayload: ValuableActionMutationPayload) {
    try {
      const result = await mutations.create.mutateAsync({ mode: adminMode.mode, payload: basePayload });

      if (adminMode.mode !== "direct_write") {
        const draftSaved = persistGovernanceDraft(buildValuableActionCreateDraftKey(communityId), basePayload);
        setCreateGovernanceCta(true);
        setStatusMessage(buildGovernanceFallbackMessage(adminAuthority.status, "create", draftSaved));
        return;
      }

      if (!result.contractPayload) {
        throw new Error("Unable to build Valuable Action contract payload.");
      }
      if (!publicClient || !modules?.valuableActionRegistry) {
        throw new Error("ValuableActionRegistry module is not registered for this community.");
      }

      const proposalRef = keccak256(
        stringToHex(
          `${communityId}:${(basePayload.title ?? "").trim()}:${(basePayload.metadataCid ?? "").trim()}:${Date.now()}`
        )
      );

      try {
        const receipt = await submitDirectRegistryWrite({
          functionName: "proposeValuableAction",
          args: [result.contractPayload, proposalRef],
        });

        const decodedActionId = extractCreatedActionIdFromReceipt(receipt);
        setCreatedActionId(decodedActionId);
        setStatusMessage(
          decodedActionId !== null
            ? "Valuable Action proposed on-chain. Continue with activation proposal."
            : "Valuable Action proposed on-chain, but the created action id could not be decoded from the receipt. Locate the new action in the list to continue with activation."
        );
      } catch (writeError) {
        if (isAccessManagedUnauthorized(writeError)) {
          const draftSaved = persistGovernanceDraft(buildValuableActionCreateDraftKey(communityId), basePayload);
          setCreateGovernanceCta(true);
          setStatusMessage(
            `Direct write was rejected on-chain for this wallet. Continue via governance proposal. ${buildDraftPersistenceSuffix(draftSaved)}`
          );
          return;
        }
        throw writeError;
      }
    } catch (error) {
      setErrorMessage(extractWriteFailureMessage(error));
    }
  }

  async function handleEditSubmit(basePayload: ValuableActionMutationPayload) {
    const actionId = action?.actionId;
    if (typeof actionId !== "number") {
      setErrorMessage("Select a Valuable Action before editing.");
      return;
    }

    const editPayload = { ...basePayload, actionId };

    try {
      const result = await mutations.edit.mutateAsync({ mode: adminMode.mode, payload: editPayload });

      if (adminMode.mode !== "direct_write") {
        const draftSaved = persistGovernanceDraft(buildValuableActionEditDraftKey(communityId, actionId), editPayload);
        setEditGovernanceCta(true);
        setStatusMessage(buildGovernanceFallbackMessage(adminAuthority.status, "edit", draftSaved));
        return;
      }

      if (!result.contractPayload) {
        throw new Error("Unable to build Valuable Action contract payload.");
      }

      try {
        await submitDirectRegistryWrite({
          functionName: "update",
          args: [BigInt(actionId), result.contractPayload],
        });
        setStatusMessage(`Valuable Action #${actionId} updated on-chain.`);
      } catch (writeError) {
        if (isAccessManagedUnauthorized(writeError)) {
          const draftSaved = persistGovernanceDraft(buildValuableActionEditDraftKey(communityId, actionId), editPayload);
          setEditGovernanceCta(true);
          setStatusMessage(
            `Direct update was rejected on-chain for this wallet. Continue via governance proposal. ${buildDraftPersistenceSuffix(draftSaved)}`
          );
          return;
        }
        throw writeError;
      }
    } catch (error) {
      setErrorMessage(extractWriteFailureMessage(error));
    }
  }

  async function handleActivationToggle() {
    const actionId = action?.actionId;
    if (readinessBlocked || typeof actionId !== "number") return;
    if (activationMode.mode !== "direct_write") return;

    setActivationStatusMessage(null);
    setActivationErrorMessage(null);
    setIsTogglingActivation(true);

    try {
      if (!modules?.valuableActionRegistry) {
        throw new Error("ValuableActionRegistry module is not registered for this community.");
      }
      if (!publicClient) {
        throw new Error("Public client unavailable for transaction confirmation.");
      }
      if (!address) {
        throw new Error("Connect a wallet to continue.");
      }

      if (action?.isActive) {
        await publicClient.simulateContract({
          address: modules.valuableActionRegistry,
          abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
          functionName: "deactivate",
          args: [BigInt(actionId)],
          account: address as Address,
        });
        const txHash = await writeContractAsync({
          address: modules.valuableActionRegistry,
          abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
          functionName: "deactivate",
          args: [BigInt(actionId)],
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setActivationStatusMessage(`Valuable Action #${actionId} deactivated on-chain.`);
      } else {
        const proposalRef = await publicClient.readContract({
          address: modules.valuableActionRegistry,
          abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
          functionName: "pendingValuableActions",
          args: [BigInt(actionId)],
        });

        if (
          !proposalRef ||
          proposalRef === "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          setActivationErrorMessage(
            `No pending governance reference exists for Valuable Action #${actionId}. Activation requires a pending proposal reference.`
          );
          return;
        }

        await publicClient.simulateContract({
          address: modules.valuableActionRegistry,
          abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
          functionName: "activateFromGovernance",
          args: [BigInt(actionId), proposalRef],
          account: address as Address,
        });
        const txHash = await writeContractAsync({
          address: modules.valuableActionRegistry,
          abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
          functionName: "activateFromGovernance",
          args: [BigInt(actionId), proposalRef],
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setActivationStatusMessage(`Valuable Action #${actionId} activated on-chain.`);
      }
    } catch (error) {
      if (isAccessManagedUnauthorized(error)) {
        setActivationErrorMessage(
          "Direct activation change was rejected on-chain for this wallet. Use the governance proposal link below."
        );
      } else {
        setActivationErrorMessage(extractWriteFailureMessage(error));
      }
    } finally {
      setIsTogglingActivation(false);
    }
  }

  return (
    <section className="card space-y-3 p-4" aria-label="valuable-action-admin-panel">
      <h3 className="text-lg font-semibold">{isCreateFlow ? "Create Valuable Action" : "Admin"}</h3>
      {blockedReason ? <p className="text-sm text-red-600">{blockedReason}</p> : null}
      {mutationBlocked ? (
        <p className="text-sm text-amber-600">Projection unavailable. Mutations are gated until readiness recovers.</p>
      ) : null}
      {adminAuthority.isChecking ? (
        <p className="text-xs text-muted-foreground">Verifying wallet authority against the community AccessManager...</p>
      ) : null}
      {adminMode.mode === "direct_write" ? (
        <p className="text-xs text-emerald-600">
          Connected wallet is verified for direct on-chain execution via the community AccessManager.
        </p>
      ) : null}
      {adminMode.mode === "governance_required" ? (
        <p className="text-xs text-muted-foreground">
          The connected wallet has no verified direct authority for this operation. Changes are executed through
          governance proposals; evidence spec is pinned to IPFS automatically when you submit.
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
          if (adminMode.mode === "blocked") return;
          setPreviewPayload(payload);
          setCreatedActionId(null);
          setCreateGovernanceCta(false);
          setEditGovernanceCta(false);
          setErrorMessage(null);
          setStatusMessage(null);

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
          };

          if (isCreateFlow) {
            await handleCreateSubmit(basePayload);
            return;
          }

          await handleEditSubmit(basePayload);
        }}
      />

      {previewPayload ? <ValuableActionSubmitPreview payload={previewPayload} /> : null}

      {statusMessage ? <p className="text-xs text-emerald-600">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
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
      {isCreateFlow && createGovernanceCta ? (
        <Link
          className="btn-outline"
          href={buildValuableActionProposalHref({ communityId, operation: "create" })}
        >
          Open governance proposal builder
        </Link>
      ) : null}
      {!isCreateFlow && editGovernanceCta && typeof action?.actionId === "number" ? (
        <Link
          className="btn-outline"
          href={buildValuableActionProposalHref({
            communityId,
            operation: "edit",
            actionId: action.actionId,
          })}
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
          void handleActivationToggle();
        }}
      />

      {isTogglingActivation ? (
        <p className="text-xs text-muted-foreground">Submitting activation transaction...</p>
      ) : null}
      {activationStatusMessage ? <p className="text-xs text-emerald-600">{activationStatusMessage}</p> : null}
      {activationErrorMessage ? <p className="text-xs text-destructive">{activationErrorMessage}</p> : null}
      {isWriting ? (
        <p className="text-xs text-muted-foreground">Submitting Valuable Action transaction...</p>
      ) : null}
    </section>
  );
}
