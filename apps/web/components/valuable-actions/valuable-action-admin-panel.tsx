"use client";

import Link from "next/link";
import { useState } from "react";

import type { ValuableActionDto } from "../../lib/graphql/queries";
import { useValuableActionAuthorityMode } from "../../hooks/useValuableActionAuthorityMode";
import { useValuableActionAdminMutations } from "../../hooks/useValuableActionAdminMutations";
import { buildValuableActionProposalHref } from "../../lib/valuable-actions/governance";
import { ValuableActionActivationControls } from "./valuable-action-activation-controls";
import { ValuableActionForm, type ValuableActionFormValue } from "./valuable-action-form";
import { ValuableActionSubmitPreview } from "./valuable-action-submit-preview";

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
  const [previewPayload, setPreviewPayload] = useState<ValuableActionFormValue | null>(null);
  const mutations = useValuableActionAdminMutations();
  const isCreateFlow = !action;

  const adminMode = useValuableActionAuthorityMode({
    operation: isCreateFlow ? "create" : "edit",
    boundaryValid,
    hasDirectWrite: false,
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

      <ValuableActionForm
        initialValue={{
          title: action?.title ?? "",
          metadataCid: action?.evidenceSpecCid ?? "",
          ruleSummary: "",
        }}
        onSubmit={(payload) => {
          if (mutationBlocked) return;
          setPreviewPayload(payload);
          if (isCreateFlow) {
            void mutations.create.mutateAsync({
              mode: adminMode.mode,
              payload: {
                communityId,
                title: payload.title,
                metadataCid: payload.metadataCid,
                ruleSummary: payload.ruleSummary,
              },
            });
            return;
          }

          void mutations.edit.mutateAsync({
            mode: adminMode.mode,
            payload: {
              communityId,
              actionId: action?.actionId,
              title: payload.title,
              metadataCid: payload.metadataCid,
              ruleSummary: payload.ruleSummary,
            },
          });
        }}
      />

      {previewPayload ? <ValuableActionSubmitPreview payload={previewPayload} /> : null}

      {adminMode.mode !== "direct_write" ? (
        <Link
          className="btn-outline"
          href={buildValuableActionProposalHref({ communityId, operation: "create" })}
        >
          Open Governance Proposal Builder
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
    </section>
  );
}
