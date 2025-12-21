import Link from "next/link";

import { formatDate, statusBadge } from "./helpers";
import type { RequestStatus } from "./types";

export type RequestDetailHeaderProps = {
  title: string;
  requestId: number;
  communityId: number;
  author: string;
  status: RequestStatus;
  submittedAt?: string | number | Date | null;
  tags?: string[];
  linkedValuableActionId?: number | null;
  bountyAmount: string;
  canLinkValuableAction: boolean;
  linkDraft: string;
  onLinkDraftChange: (value: string) => void;
  onLinkValuableAction: () => void;
  isWriting: boolean;
  canModerate: boolean;
  statusDraft: string | null;
  statusOptions: { key: string; label: string; value: number }[];
  onStatusDraftChange: (value: string) => void;
  onStatusUpdate: () => void;
  isUpdatingStatus: boolean;
};

export function RequestDetailHeader({
  title,
  requestId,
  communityId,
  author,
  status,
  submittedAt,
  tags,
  linkedValuableActionId,
  bountyAmount,
  canLinkValuableAction,
  linkDraft,
  onLinkDraftChange,
  onLinkValuableAction,
  isWriting,
  canModerate,
  statusDraft,
  statusOptions,
  onStatusDraftChange,
  onStatusUpdate,
  isUpdatingStatus
}: RequestDetailHeaderProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{title}</h2>
          <span className="text-xs text-muted-foreground">ID {requestId}</span>
        </div>
        <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="font-medium text-foreground">Community</dt>
            <dd>{communityId}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-medium text-foreground">Author</dt>
            <dd>{author}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-medium text-foreground">Status</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(status).className}`}>
                {statusBadge(status).label}
              </span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="font-medium text-foreground">Submitted</dt>
            <dd>{formatDate(submittedAt)}</dd>
          </div>
        </dl>
        {tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Linked Valuable Action</span>
            <span className="text-muted-foreground">
              {linkedValuableActionId ? `Valuable Action ${linkedValuableActionId}` : "Not linked"}
            </span>
            {linkedValuableActionId ? (
              <Link className="text-xs underline" href={`/claims?valuableActionId=${linkedValuableActionId}`}>
                Submit or view claims
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Bounty</span>
            <span className="text-muted-foreground">{bountyAmount ?? "0"}</span>
          </div>
          {canLinkValuableAction ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={linkDraft}
                onChange={(e) => onLinkDraftChange(e.target.value)}
                className="w-40 rounded border border-border bg-background px-2 py-1 text-xs"
                placeholder="Enter VA ID"
              />
              <button
                type="button"
                onClick={() => void onLinkValuableAction()}
                className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                disabled={isWriting}
              >
                {linkedValuableActionId ? "Update link" : "Link VA"}
              </button>
            </div>
          ) : null}
        </div>
        {canModerate ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Moderation:</span>
            <select
              value={statusDraft ?? statusOptions[0]?.key}
              onChange={(e) => onStatusDraftChange(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs"
              disabled={isUpdatingStatus || isWriting}
            >
              {statusOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void onStatusUpdate()}
              disabled={isUpdatingStatus || isWriting}
              className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isUpdatingStatus ? "Updating…" : "Update status"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
