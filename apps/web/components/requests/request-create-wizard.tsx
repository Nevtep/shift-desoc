"use client";

import { useEffect, useMemo, useState } from "react";

import { useRequestCreate } from "../../hooks/useRequestCreate";
import { getI18n } from "../../lib/i18n";
import { useToast } from "../ui/toaster";

const TOTAL_STEPS = 3;

function formatStep(template: string, current: number, total: number): string {
  return template.replace("{current}", String(current)).replace("{total}", String(total));
}

type WizardInnerProps = {
  variant: "embedded" | "modal";
  fixedCommunityId?: number;
  successRedirectHref?: string;
  initialCommunityId?: string;
  onDismiss?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export function RequestCreateWizard(props: WizardInnerProps) {
  const { variant, fixedCommunityId, successRedirectHref, initialCommunityId, onDismiss, onBusyChange } = props;
  const { push } = useToast();
  const tw = getI18n().requestWizard;

  const ctx = useRequestCreate({
    fixedCommunityId,
    successRedirectHref,
    initialCommunityId,
    toastPush: push
  });

  const {
    chainId,
    isConnected,
    disabled,
    isFixedCommunity,
    communityId,
    setCommunityId,
    title,
    setTitle,
    body,
    setBody,
    tags,
    setTags,
    requestType,
    setRequestType,
    selectedValuableActionId,
    setSelectedValuableActionId,
    isFetchingModules,
    isFetchingVas,
    activeVaIds,
    requestHubAddress,
    communityIdNum,
    error,
    handleSubmit,
    isPending,
    isUploading
  } = ctx;

  const [stepIndex, setStepIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const isBusy = isPending || isUploading;

  useEffect(() => {
    onBusyChange?.(isBusy);
    return () => onBusyChange?.(false);
  }, [isBusy, onBusyChange]);

  const stepTitles = useMemo(
    () => [tw.stepScopeTitle, tw.stepContentTitle, tw.stepReviewTitle],
    [tw.stepContentTitle, tw.stepReviewTitle, tw.stepScopeTitle]
  );

  const stepHints = useMemo(
    () => [tw.stepScopeHint, tw.stepContentHint, tw.stepReviewHint],
    [tw.stepContentHint, tw.stepReviewHint, tw.stepScopeHint]
  );

  useEffect(() => {
    setStepIndex(0);
    setLocalError(null);
  }, [fixedCommunityId, initialCommunityId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (variant !== "modal" || e.key !== "Escape" || isBusy) return;
      onDismiss?.();
    }
    if (variant === "modal") {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    return undefined;
  }, [variant, isBusy, onDismiss]);

  function validateForward(from: number): boolean {
    setLocalError(null);
    if (from === 0) {
      if (!Number.isFinite(communityIdNum) || communityIdNum <= 0) {
        setLocalError(tw.communityId);
        return false;
      }
      if (!requestHubAddress) {
        setLocalError(tw.moduleMissing.replace("{id}", String(communityIdNum)));
        return false;
      }
      if (requestType === "execution" && !selectedValuableActionId.trim()) {
        setLocalError(tw.valuableAction);
        return false;
      }
      return true;
    }
    if (from === 1) {
      if (!title.trim() || !body.trim()) {
        setLocalError(`${tw.title} / ${tw.content}`);
        return false;
      }
      return true;
    }
    return true;
  }

  function nextStep() {
    if (!validateForward(stepIndex)) return;
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS - 1));
  }

  function prevStep() {
    setLocalError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function onConfirmSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateForward(1)) {
      setStepIndex(1);
      return;
    }
    await handleSubmit(() => {
      if (variant === "modal") onDismiss?.();
    });
  }

  const requestTypeReview =
    requestType === "execution" ? tw.typeExecution : tw.typeGovernance;

  const panelClass =
    variant === "modal"
      ? "relative z-10 w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/25 bg-background p-6 shadow-[0_24px_64px_rgba(86,102,69,0.18)] sm:p-8"
      : "relative card overflow-hidden border-primary/20 p-6 sm:p-8";

  const inner = (
    <div className={panelClass}>
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-95"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 border-b border-primary/10 pb-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold text-primary sm:text-xl">{tw.panelTitle}</h2>
          <p className="text-sm text-muted-foreground">{tw.panelSubtitle}</p>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>
            {tw.network}: {chainId ?? "—"}
          </div>
        </div>
      </div>

      <ol className="mt-5 flex flex-wrap gap-2" aria-label={formatStep(tw.stepOf, stepIndex + 1, TOTAL_STEPS)}>
        {stepTitles.map((label, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <li key={label}>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 transition-colors ${
                  active
                    ? "bg-primary/12 text-primary ring-primary/30"
                    : done
                      ? "bg-secondary/15 text-secondaryDark ring-secondary/25"
                      : "bg-muted/50 text-muted-foreground ring-border"
                }`}
              >
                <span className="tabular-nums">{i + 1}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">{stepHints[stepIndex]}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{formatStep(tw.stepOf, stepIndex + 1, TOTAL_STEPS)}</p>

      {localError ? <p className="mt-3 text-sm text-destructive">{localError}</p> : null}

      <form className="mt-6 space-y-5" onSubmit={stepIndex === TOTAL_STEPS - 1 ? onConfirmSubmit : (e) => e.preventDefault()}>
        {stepIndex === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium text-foreground">{tw.requestType}</legend>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background/80 p-3 ring-primary/20 has-[:checked]:ring-2">
                  <input
                    type="radio"
                    name="request-type"
                    value="governance"
                    checked={requestType === "governance"}
                    onChange={() => setRequestType("governance")}
                    className="mt-1"
                  />
                  <span className="text-sm leading-snug">{tw.typeGovernance}</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background/80 p-3 ring-primary/20 has-[:checked]:ring-2">
                  <input
                    type="radio"
                    name="request-type"
                    value="execution"
                    checked={requestType === "execution"}
                    onChange={() => setRequestType("execution")}
                    className="mt-1"
                  />
                  <span className="text-sm leading-snug">{tw.typeExecution}</span>
                </label>
              </div>
            </fieldset>

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{isFixedCommunity ? tw.communityFixed : tw.communityId}</span>
              {isFixedCommunity ? (
                <div className="rounded-xl border border-border bg-muted/60 px-3 py-2.5 font-medium">
                  #{communityId}
                </div>
              ) : (
                <input
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5"
                  placeholder="1"
                  inputMode="numeric"
                  autoComplete="off"
                />
              )}
            </label>

            {requestType === "execution" ? (
              <label className="flex flex-col gap-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">{tw.valuableAction}</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <select
                    value={selectedValuableActionId}
                    onChange={(e) => setSelectedValuableActionId(e.target.value)}
                    className="grow rounded-xl border border-border bg-background px-3 py-2.5"
                    disabled={isFetchingModules || isFetchingVas || activeVaIds.length === 0}
                  >
                    <option value="">{isFetchingVas ? tw.loadingActions : tw.selectAction}</option>
                    {activeVaIds.map((id) => (
                      <option key={id} value={id}>
                        {tw.reviewExecution} {id}
                      </option>
                    ))}
                  </select>
                  <input
                    value={selectedValuableActionId}
                    onChange={(e) => setSelectedValuableActionId(e.target.value)}
                    className="grow rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm"
                    placeholder={tw.actionManual}
                    aria-label={tw.actionManual}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{tw.actionHelp}</span>
              </label>
            ) : null}
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{tw.title}</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2.5"
                placeholder={tw.titlePlaceholder}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{tw.tags}</span>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2.5"
                placeholder={tw.tagsPlaceholder}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{tw.content}</span>
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[180px] rounded-xl border border-border bg-background px-3 py-2.5"
                placeholder={tw.contentPlaceholder}
              />
            </label>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <dl className="grid gap-3 rounded-xl border border-primary/10 bg-gradient-to-br from-[rgba(246,240,225,0.5)] via-background to-background px-4 py-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2 border-b border-border/70 pb-2">
              <dt className="text-muted-foreground">{tw.reviewType}</dt>
              <dd className="font-medium text-foreground">{requestTypeReview}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border/70 pb-2">
              <dt className="text-muted-foreground">{tw.reviewCommunity}</dt>
              <dd className="font-mono font-medium">#{communityIdNum}</dd>
            </div>
            {requestType === "execution" && selectedValuableActionId ? (
              <div className="flex flex-wrap justify-between gap-2 border-b border-border/70 pb-2">
                <dt className="text-muted-foreground">{tw.reviewExecution}</dt>
                <dd className="font-mono font-medium">{selectedValuableActionId}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-between gap-2 border-b border-border/70 pb-2">
              <dt className="text-muted-foreground">{tw.reviewTitle}</dt>
              <dd className="max-w-[min(100%,20rem)] text-right font-medium">{title.trim() || "—"}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border/70 pb-2">
              <dt className="text-muted-foreground">{tw.reviewTags}</dt>
              <dd className="text-right">
                {tags.trim()
                  ? tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{tw.reviewBody}</dt>
              <dd className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
                {body.trim() || "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-5">
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <button type="button" className="btn-ghost cursor-pointer text-sm" onClick={prevStep} disabled={isBusy}>
                {tw.back}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isConnected ? <span className="text-xs text-destructive">{tw.connectWallet}</span> : null}
            {error ? <span className="text-xs text-destructive">{error.message ?? "—"}</span> : null}
            {stepIndex < TOTAL_STEPS - 1 ? (
              <button type="button" className="btn-primary cursor-pointer" onClick={nextStep} disabled={isBusy}>
                {tw.next}
              </button>
            ) : (
              <button type="submit" disabled={disabled} className="btn-primary cursor-pointer">
                {isBusy ? tw.submitting : tw.submit}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );

  return inner;
}

type ModalProps = {
  initialCommunityId?: string;
};

export function RequestCreateWizardModal({ initialCommunityId }: ModalProps) {
  const t = getI18n().requestsPage;
  const tw = getI18n().requestWizard;
  const [open, setOpen] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);

  useEffect(() => {
    function onNavigate() {
      setOpen(false);
    }
    if (typeof window === "undefined") return undefined;
    window.addEventListener("popstate", onNavigate);
    return () => window.removeEventListener("popstate", onNavigate);
  }, []);

  return (
    <>
      <button type="button" className="btn-primary cursor-pointer" onClick={() => setOpen(true)}>
        {t.ctaNewRequest}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] disabled:pointer-events-none"
            aria-label={tw.closeModal}
            disabled={modalBusy}
            onClick={() => !modalBusy && setOpen(false)}
          />
          <div
            className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <RequestCreateWizard
              variant="modal"
              initialCommunityId={initialCommunityId}
              onDismiss={() => setOpen(false)}
              onBusyChange={setModalBusy}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
