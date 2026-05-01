"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type ProposalTitleWithCopyProps = {
  titleText: string;
  copyValue: string;
  copyLabel: string;
  copiedLabel: string;
};

export function ProposalTitleWithCopy({
  titleText,
  copyValue,
  copyLabel,
  copiedLabel
}: ProposalTitleWithCopyProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{titleText}</h1>
      <button
        type="button"
        aria-label={copied ? copiedLabel : copyLabel}
        title={copied ? copiedLabel : copyLabel}
        onClick={onCopy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
