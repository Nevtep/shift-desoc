"use client";

import type { PreparedAction } from "../drafts/draft-create-form";

import { getI18n } from "../../lib/i18n";

type ComposerMode = "guided" | "expert";
type ProposalMode = "binary" | "multi_choice";

type DirectProposalCreateComponentProps = {
  communityId: number;
  composerMode: ComposerMode;
  proposalMode: ProposalMode;
  numOptions: number;
  title: string;
  summary: string;
  description: string;
  actions: PreparedAction[];
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  statusMessage: string | null;
  onComposerModeChange: (mode: ComposerMode) => void;
  onProposalModeChange: (mode: ProposalMode) => void;
  onNumOptionsChange: (value: number) => void;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onRemoveAction: (index: number) => void;
  onMoveAction: (index: number, direction: -1 | 1) => void;
  composerSection: React.ReactNode;
  actionsSection: React.ReactNode;
};

export function DirectProposalCreateComponent(props: DirectProposalCreateComponentProps) {
  const t = getI18n().governance;
  const isMultiChoice = props.proposalMode === "multi_choice";

  return (
    <section className="card space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t.directCreateTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.directCreateSubtitle}</p>
        <p className="text-xs text-muted-foreground">
          {t.directCreateScope.replace("{id}", String(props.communityId))}{" "}
          <a className="underline" href={`/communities/${props.communityId}/coordination/drafts`}>
            {t.draftsLink}
          </a>
          .
        </p>
      </div>

      <details className="rounded-xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
          {t.directCreateAdvanced}
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t.directCreateComposer}</span>
            <select
              className="rounded border border-border bg-background px-3 py-2"
              value={props.composerMode}
              onChange={(event) => props.onComposerModeChange(event.target.value as ComposerMode)}
              disabled={props.isSubmitting}
            >
              <option value="guided">{t.directCreateComposerGuided}</option>
              <option value="expert">{t.directCreateComposerExpert}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t.directCreateProposalMode}</span>
            <select
              className="rounded border border-border bg-background px-3 py-2"
              value={props.proposalMode}
              onChange={(event) => props.onProposalModeChange(event.target.value as ProposalMode)}
              disabled={props.isSubmitting}
            >
              <option value="binary">{t.directCreateBinaryFriendly}</option>
              <option value="multi_choice">{t.directCreateMultiFriendly}</option>
            </select>
          </label>

          {isMultiChoice ? (
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{t.directCreateNumOptions}</span>
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

          <p className="text-xs text-muted-foreground sm:col-span-2">
            <span className="font-medium text-foreground">{t.technicalNote}:</span> {t.directCreateBinaryTechnical} ·{" "}
            {t.directCreateMultiTechnical}
          </p>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{t.directCreateTitleField}</span>
          <input
            className="rounded border border-border bg-background px-3 py-2"
            value={props.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            placeholder="Reduce review period latency"
            disabled={props.isSubmitting}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{t.directCreateSummaryField}</span>
          <input
            className="rounded border border-border bg-background px-3 py-2"
            value={props.summary}
            onChange={(event) => props.onSummaryChange(event.target.value)}
            placeholder="Set review periods to minimum to accelerate moderation workflows."
            disabled={props.isSubmitting}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{t.directCreateDescriptionField}</span>
          <textarea
            className="min-h-[120px] rounded border border-border bg-background px-3 py-2"
            value={props.description}
            onChange={(event) => props.onDescriptionChange(event.target.value)}
            placeholder="Describe rationale, scope, risks, and expected outcomes."
            disabled={props.isSubmitting}
          />
        </label>
      </div>

      {props.composerSection}
      {props.actionsSection}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={props.isSubmitting} onClick={props.onSubmit}>
          {props.isSubmitting ? t.submitting : t.directCreateSubmit}
        </button>
        {props.statusMessage ? <span className="text-xs text-muted-foreground">{props.statusMessage}</span> : null}
        {props.successMessage ? <span className="text-xs text-emerald-700">{props.successMessage}</span> : null}
        {props.errorMessage ? <span className="text-xs text-destructive">{props.errorMessage}</span> : null}
      </div>
    </section>
  );
}
