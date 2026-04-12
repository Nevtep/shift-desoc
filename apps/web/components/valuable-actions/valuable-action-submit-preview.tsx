"use client";

import type { ValuableActionFormValue } from "./valuable-action-form";

type Props = {
  payload: ValuableActionFormValue;
};

export function ValuableActionSubmitPreview({ payload }: Props) {
  const requiredEvidenceCount = payload.evidenceRequirements
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean).length;

  return (
    <section className="card space-y-2 p-3" aria-label="valuable-action-submit-preview">
      <h3 className="text-sm font-semibold">Submit Preview</h3>
      <p className="text-xs text-muted-foreground">Title: {payload.title || "-"}</p>
      <p className="text-xs text-muted-foreground">Metadata CID: {payload.metadataCid || "-"}</p>
      <p className="text-xs text-muted-foreground">Rule Summary: {payload.ruleSummary || "-"}</p>
      <p className="text-xs text-muted-foreground">Evidence Summary: {payload.evidenceSummary || "-"}</p>
      <p className="text-xs text-muted-foreground">Required Evidence Items: {requiredEvidenceCount}</p>
      <p className="text-xs text-muted-foreground">Category: {payload.category}</p>
      <p className="text-xs text-muted-foreground">Verifier policy: {payload.verifierPolicy}</p>
      <p className="text-xs text-muted-foreground">Panel: {payload.jurorsMin} of {payload.panelSize}</p>
      <p className="text-xs text-muted-foreground">Verify window: {payload.verifyWindow}s</p>
      <p className="text-xs text-muted-foreground">Cooldown: {payload.cooldownPeriod}s</p>
      <p className="text-xs text-muted-foreground">Membership reward: {payload.membershipTokenReward}</p>
      <p className="text-xs text-muted-foreground">Community reward: {payload.communityTokenReward}</p>
      <p className="text-xs text-muted-foreground">Revocable: {payload.revocable ? "yes" : "no"}</p>
      <p className="text-xs text-muted-foreground">Proposal threshold: {payload.proposalThreshold || "0"}</p>
    </section>
  );
}
