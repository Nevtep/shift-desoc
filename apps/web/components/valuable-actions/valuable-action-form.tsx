"use client";

import { useMemo, useState } from "react";

export type ValuableActionFormValue = {
  title: string;
  metadataCid: string;
  ruleSummary: string;
  evidenceSummary: string;
  evidenceRequirements: string;
  verificationChecklist: string;
  referenceLinks: string;
  category: "ENGAGEMENT_ONE_SHOT" | "POSITION_ASSIGNMENT" | "INVESTMENT" | "CREDENTIAL";
  verifierPolicy: "NONE" | "FIXED" | "ROLE_BASED" | "JURY" | "MULTISIG";
  membershipTokenReward: number;
  communityTokenReward: number;
  jurorsMin: number;
  panelSize: number;
  verifyWindow: number;
  cooldownPeriod: number;
  revocable: boolean;
  proposalThreshold: string;
};

type Props = {
  initialValue?: Partial<ValuableActionFormValue>;
  onSubmit: (value: ValuableActionFormValue) => void | Promise<void>;
};

function parseMultiline(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateValuableActionForm(
  value: ValuableActionFormValue,
  options?: { allowExistingMetadataCid?: boolean }
) {
  const errors: string[] = [];
  if (!value.title.trim()) errors.push("Title is required");
  const needsEvidenceSpec = !(options?.allowExistingMetadataCid && value.metadataCid.trim());
  if (needsEvidenceSpec && !value.evidenceSummary.trim()) errors.push("Evidence summary is required");
  if (needsEvidenceSpec && parseMultiline(value.evidenceRequirements).length === 0) errors.push("At least one required evidence item is needed");
  if (value.membershipTokenReward < 0 || value.communityTokenReward < 0) errors.push("Rewards must be zero or positive");
  if (value.panelSize <= 0) errors.push("Panel size must be greater than zero");
  if (value.jurorsMin <= 0 || value.jurorsMin > value.panelSize) errors.push("Minimum approvals must be between 1 and panel size");
  if (value.verifyWindow <= 0) errors.push("Verify window must be greater than zero");
  if (value.cooldownPeriod <= 0) errors.push("Cooldown must be greater than zero");
  return errors;
}

export function ValuableActionForm({ initialValue, onSubmit }: Props) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [metadataCid, setMetadataCid] = useState(initialValue?.metadataCid ?? "");
  const [ruleSummary, setRuleSummary] = useState(initialValue?.ruleSummary ?? "");
  const [evidenceSummary, setEvidenceSummary] = useState(initialValue?.evidenceSummary ?? "");
  const [evidenceRequirements, setEvidenceRequirements] = useState(initialValue?.evidenceRequirements ?? "");
  const [verificationChecklist, setVerificationChecklist] = useState(initialValue?.verificationChecklist ?? "");
  const [referenceLinks, setReferenceLinks] = useState(initialValue?.referenceLinks ?? "");
  const [category, setCategory] = useState<ValuableActionFormValue["category"]>(initialValue?.category ?? "ENGAGEMENT_ONE_SHOT");
  const [verifierPolicy, setVerifierPolicy] = useState<ValuableActionFormValue["verifierPolicy"]>(initialValue?.verifierPolicy ?? "JURY");
  const [membershipTokenReward, setMembershipTokenReward] = useState(initialValue?.membershipTokenReward ?? 0);
  const [communityTokenReward, setCommunityTokenReward] = useState(initialValue?.communityTokenReward ?? 0);
  const [jurorsMin, setJurorsMin] = useState(initialValue?.jurorsMin ?? 3);
  const [panelSize, setPanelSize] = useState(initialValue?.panelSize ?? 5);
  const [verifyWindow, setVerifyWindow] = useState(initialValue?.verifyWindow ?? 604800);
  const [cooldownPeriod, setCooldownPeriod] = useState(initialValue?.cooldownPeriod ?? 86400);
  const [revocable, setRevocable] = useState(initialValue?.revocable ?? true);
  const [proposalThreshold, setProposalThreshold] = useState(initialValue?.proposalThreshold ?? "0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedCid, setUploadedCid] = useState(initialValue?.metadataCid ?? "");

  const value = useMemo(
    () => ({
      title,
      metadataCid,
      ruleSummary,
      evidenceSummary,
      evidenceRequirements,
      verificationChecklist,
      referenceLinks,
      category,
      verifierPolicy,
      membershipTokenReward,
      communityTokenReward,
      jurorsMin,
      panelSize,
      verifyWindow,
      cooldownPeriod,
      revocable,
      proposalThreshold,
    }),
    [
      title,
      metadataCid,
      ruleSummary,
      evidenceSummary,
      evidenceRequirements,
      verificationChecklist,
      referenceLinks,
      category,
      verifierPolicy,
      membershipTokenReward,
      communityTokenReward,
      jurorsMin,
      panelSize,
      verifyWindow,
      cooldownPeriod,
      revocable,
      proposalThreshold,
    ]
  );
  const errors = useMemo(
    () => validateValuableActionForm(value, { allowExistingMetadataCid: Boolean(initialValue?.metadataCid) }),
    [initialValue?.metadataCid, value]
  );

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitError(null);
        if (errors.length) return;

        const hasInlineEvidence =
          evidenceSummary.trim().length > 0 ||
          evidenceRequirements.trim().length > 0 ||
          verificationChecklist.trim().length > 0 ||
          referenceLinks.trim().length > 0;

        let nextMetadataCid = metadataCid;

        try {
          if (!nextMetadataCid || hasInlineEvidence) {
            setIsUploading(true);

            const payload = {
              type: "valuableActionEvidenceSpec",
              version: "1",
              title: title.trim(),
              category,
              verifierPolicy,
              ruleSummary: ruleSummary.trim(),
              evidenceSummary: evidenceSummary.trim(),
              requiredEvidence: parseMultiline(evidenceRequirements),
              verificationChecklist: parseMultiline(verificationChecklist),
              references: parseMultiline(referenceLinks),
              createdAt: new Date().toISOString(),
            };

            const uploadResponse = await fetch("/api/ipfs/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload }),
            });

            const uploadJson = (await uploadResponse.json()) as { cid?: string; error?: string };
            if (!uploadResponse.ok || !uploadJson.cid) {
              throw new Error(uploadJson.error ?? "Failed to upload evidence spec to IPFS");
            }

            nextMetadataCid = uploadJson.cid;
            setMetadataCid(nextMetadataCid);
            setUploadedCid(nextMetadataCid);
          }

          await onSubmit({
            ...value,
            metadataCid: nextMetadataCid,
          });
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : "Failed to prepare evidence spec");
        } finally {
          setIsUploading(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block">Title *</span>
        <input aria-label="Valuable action title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="mt-1 block text-xs text-muted-foreground">Use a clear title members will recognize in governance and engagement flows.</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block">Rule Summary</span>
        <textarea aria-label="Valuable action rule summary" className="input" value={ruleSummary} onChange={(e) => setRuleSummary(e.target.value)} />
      </label>

      <section className="space-y-2 rounded-xl border border-border p-3" aria-label="valuable-action-evidence-spec">
        <h4 className="text-sm font-semibold">Evidence Spec</h4>
        <p className="text-xs text-muted-foreground">
          Fill the protocol evidence requirements below. The app uploads this spec to IPFS and generates the CID automatically.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block">Evidence Summary *</span>
          <textarea
            aria-label="Valuable action evidence summary"
            className="input"
            value={evidenceSummary}
            onChange={(e) => setEvidenceSummary(e.target.value)}
            placeholder="Describe what verifiers must confirm before approving this action."
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Required Evidence (one item per line) *</span>
          <textarea
            aria-label="Valuable action required evidence"
            className="input"
            value={evidenceRequirements}
            onChange={(e) => setEvidenceRequirements(e.target.value)}
            placeholder={"Proof of completion URL\nSigned deliverable\nTimestamped artifact"}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Verifier Checklist (optional, one item per line)</span>
          <textarea
            aria-label="Valuable action verifier checklist"
            className="input"
            value={verificationChecklist}
            onChange={(e) => setVerificationChecklist(e.target.value)}
            placeholder={"Evidence is readable\nArtifact matches scope\nNo duplicate submission"}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Reference Links (optional, one URL per line)</span>
          <textarea
            aria-label="Valuable action reference links"
            className="input"
            value={referenceLinks}
            onChange={(e) => setReferenceLinks(e.target.value)}
            placeholder={"https://docs.shift.dev/protocol/evidence\nhttps://community.xyz/rules"}
          />
        </label>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block">Action Category *</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ValuableActionFormValue["category"])}>
            <option value="ENGAGEMENT_ONE_SHOT">One-shot engagement</option>
            <option value="POSITION_ASSIGNMENT">Position assignment</option>
            <option value="INVESTMENT">Investment</option>
            <option value="CREDENTIAL">Credential</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Verifier Policy *</span>
          <select className="input" value={verifierPolicy} onChange={(e) => setVerifierPolicy(e.target.value as ValuableActionFormValue["verifierPolicy"])}>
            <option value="JURY">Jury (M-of-N)</option>
            <option value="FIXED">Fixed verifier set</option>
            <option value="ROLE_BASED">Role-based verifier set</option>
            <option value="MULTISIG">Multisig confirmation</option>
            <option value="NONE">No verifier policy</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block">Membership Token Reward</span>
          <input type="number" min={0} className="input" value={membershipTokenReward} onChange={(e) => setMembershipTokenReward(Number(e.target.value || 0))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Community Token Reward</span>
          <input type="number" min={0} className="input" value={communityTokenReward} onChange={(e) => setCommunityTokenReward(Number(e.target.value || 0))} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block">Panel Size (N) *</span>
          <input type="number" min={1} className="input" value={panelSize} onChange={(e) => setPanelSize(Number(e.target.value || 0))} />
          <span className="mt-1 block text-xs text-muted-foreground">Cuantos verificadores participan.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Minimum Approvals (M) *</span>
          <input type="number" min={1} className="input" value={jurorsMin} onChange={(e) => setJurorsMin(Number(e.target.value || 0))} />
          <span className="mt-1 block text-xs text-muted-foreground">Cuantos verificadores tienen que votar afirmativo.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Verify Window (seconds) *</span>
          <input type="number" min={1} className="input" value={verifyWindow} onChange={(e) => setVerifyWindow(Number(e.target.value || 0))} />
          <span className="mt-1 block text-xs text-muted-foreground">Tiempo maximo para emitir veredicto.</span>
        </label>
      </div>

      <button type="button" className="btn-ghost" onClick={() => setShowAdvanced((prev) => !prev)}>
        {showAdvanced ? "Hide advanced" : "Show advanced"}
      </button>

      {showAdvanced ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="block text-sm">
            <span className="mb-1 block">Cooldown Period (seconds) *</span>
            <input type="number" min={1} className="input" value={cooldownPeriod} onChange={(e) => setCooldownPeriod(Number(e.target.value || 0))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Proposal Threshold</span>
            <input className="input" value={proposalThreshold} onChange={(e) => setProposalThreshold(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revocable} onChange={(e) => setRevocable(e.target.checked)} />
            <span>Revocable by governance</span>
          </label>
        </div>
      ) : null}

      {uploadedCid ? <p className="text-xs text-muted-foreground">Evidence spec CID: {uploadedCid}</p> : null}
      {errors.length > 0 ? <p className="text-sm text-red-600">{errors[0]}</p> : null}
      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      <button type="submit" className="btn-primary" disabled={isUploading}>
        {isUploading ? "Uploading Evidence Spec..." : "Create Valuable Action Proposal"}
      </button>
    </form>
  );
}
