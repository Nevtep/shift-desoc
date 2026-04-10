"use client";

import type { PreparedAction } from "../drafts/draft-create-form";

type ComposerMode = "guided" | "expert";
type ProposalMode = "binary" | "multi_choice";

type DirectProposalCreateComponentProps = {
  communityId: number;
  composerMode: ComposerMode;
  proposalMode: ProposalMode;
  numOptions: number;
  description: string;
  actions: PreparedAction[];
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  statusMessage: string | null;
  onComposerModeChange: (mode: ComposerMode) => void;
  onProposalModeChange: (mode: ProposalMode) => void;
  onNumOptionsChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onRemoveAction: (index: number) => void;
  onMoveAction: (index: number, direction: -1 | 1) => void;
  composerSection: React.ReactNode;
  actionsSection: React.ReactNode;
};

export function DirectProposalCreateComponent(props: DirectProposalCreateComponentProps) {
  const isMultiChoice = props.proposalMode === "multi_choice";

  return (
    <section className="card space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Direct Governor Proposal</h2>
        <p className="text-sm text-muted-foreground">
          Submit proposal actions directly to the community governor without changing draft escalation behavior.
        </p>
        <p className="text-xs text-muted-foreground">
          Community scope: #{props.communityId}. Draft escalation remains available in
          <a className="ml-1 underline" href={`/communities/${props.communityId}/coordination/drafts`}>
            coordination drafts
          </a>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Composer mode</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={props.composerMode}
            onChange={(event) => props.onComposerModeChange(event.target.value as ComposerMode)}
            disabled={props.isSubmitting}
          >
            <option value="guided">Guided</option>
            <option value="expert">Expert</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Proposal mode</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={props.proposalMode}
            onChange={(event) => props.onProposalModeChange(event.target.value as ProposalMode)}
            disabled={props.isSubmitting}
          >
            <option value="binary">Binary (`propose`)</option>
            <option value="multi_choice">Multi-choice (`proposeMultiChoice`)</option>
          </select>
        </label>

        {isMultiChoice ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Number of options</span>
            <input
              type="number"
              min={2}
              max={255}
              className="rounded border border-border bg-background px-3 py-2"
              value={props.numOptions}
              onChange={(event) => props.onNumOptionsChange(Number(event.target.value || "2"))}
              disabled={props.isSubmitting}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Proposal description</span>
          <textarea
            className="min-h-[120px] rounded border border-border bg-background px-3 py-2"
            value={props.description}
            onChange={(event) => props.onDescriptionChange(event.target.value)}
            placeholder="Use CID or markdown summary for deterministic proposal hash."
            disabled={props.isSubmitting}
          />
        </label>
      </div>

      {props.composerSection}
      {props.actionsSection}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={props.isSubmitting} onClick={props.onSubmit}>
          {props.isSubmitting ? "Submitting..." : "Submit proposal"}
        </button>
        {props.statusMessage ? <span className="text-xs text-muted-foreground">{props.statusMessage}</span> : null}
        {props.successMessage ? <span className="text-xs text-emerald-700">{props.successMessage}</span> : null}
        {props.errorMessage ? <span className="text-xs text-destructive">{props.errorMessage}</span> : null}
      </div>
    </section>
  );
}
