"use client";

import Link from "next/link";

import type { ValuableActionAuthorityMode } from "../../lib/community-overview/types";
import { buildValuableActionProposalHref } from "../../lib/valuable-actions/governance";

type Props = {
  communityId: number;
  actionId?: number;
  isActive: boolean;
  mode: ValuableActionAuthorityMode;
  onToggle: () => void;
};

export function ValuableActionActivationControls({ communityId, actionId, isActive, mode, onToggle }: Props) {
  const disabled = mode === "blocked";
  const label = isActive ? "Deactivate" : "Activate";

  return (
    <div className="space-y-2" aria-label="valuable-action-activation-controls">
      <p className="text-xs text-muted-foreground">
        Activation controls whether this action can be used for new engagement submissions.
      </p>
      <div className="flex items-center gap-2">
      <button type="button" className="btn-outline" disabled={disabled} onClick={onToggle}>
        {label}
      </button>
      <span className="text-xs text-muted-foreground">Mode: {mode}</span>
      </div>
      {mode !== "direct_write" && typeof actionId === "number" ? (
        <Link
          className="text-xs text-primary underline"
          href={buildValuableActionProposalHref({
            communityId,
            operation: isActive ? "deactivate" : "activate",
            actionId,
            nextActive: !isActive,
          })}
        >
          {isActive ? "Create deactivation proposal" : "Create activation proposal"}
        </Link>
      ) : null}
    </div>
  );
}
