"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  DraftQuery,
  type DraftQueryResult
} from "../../lib/graphql/queries";

export type DraftDetailProps = {
  draftId: string;
};

export function DraftDetail({ draftId }: DraftDetailProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<DraftQueryResult>(
    ["draft", draftId],
    DraftQuery,
    { id: draftId }
  );

  const draft = data?.draft ?? null;
  const latestCid = draft?.latestVersionCid ?? undefined;

  const {
    data: latestVersion,
    isLoading: isLatestLoading,
    isError: isLatestError,
    refetch: refetchLatest
  } = useIpfsDocument(latestCid, Boolean(latestCid));

  const versions = useMemo(() => draft?.versions ?? [], [draft]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading draft…</p>;
  }

  if (isError || !draft) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Failed to load draft.</p>
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Metadata</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Request</dt>
              <dd>
                <Link className="underline" href={`/requests/${draft.requestId}`}>
                  {draft.requestId}
                </Link>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Status</dt>
              <dd>{draft.status}</dd>
            </div>
            {draft.escalatedProposalId ? (
              <div className="flex items-center gap-2">
                <dt className="font-medium text-foreground">Proposal</dt>
                <dd>
                  <Link className="underline" href={`/governance/proposals/${draft.escalatedProposalId}`}>
                    {draft.escalatedProposalId}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Latest Version</h2>
        {isLatestLoading ? (
          <p className="text-sm text-muted-foreground">Loading latest version…</p>
        ) : isLatestError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">Failed to load draft content.</p>
            <button className="text-xs underline" onClick={() => void refetchLatest()}>
              Retry
            </button>
          </div>
        ) : latestVersion?.html?.body ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: latestVersion.html.body }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No markdown content available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Version History</h2>
        {versions.length ? (
          <ul className="space-y-2 text-sm">
            {versions.map((version) => (
              <VersionEntry key={version.id} version={version} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No version snapshots yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reviews</h2>
        {draft.reviews.length ? (
          <ul className="space-y-2 text-sm">
            {draft.reviews.map((review) => (
              <li key={review.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{review.reviewer}</span>
                  <span className="text-xs text-muted-foreground">{review.stance}</span>
                </div>
                <CommentContent cid={review.commentCid ?? undefined} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews submitted yet.</p>
        )}
      </section>
    </div>
  );
}

type VersionNode = {
  id: string;
  cid: string;
  contributor: string;
  createdAt: string;
};

function VersionEntry({ version }: { version: VersionNode }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(version.cid, Boolean(version.cid));

  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col text-xs text-muted-foreground">
          <span>Contributor: {version.contributor}</span>
          <span>{new Date(version.createdAt).toLocaleString()}</span>
        </div>
      </div>
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading snapshot…</p>
      ) : isError ? (
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-destructive">Failed to load snapshot.</p>
          <button className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : data?.html?.body ? (
        <article
          className="prose prose-xs mt-2 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: data.html.body }}
        />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No content available.</p>
      )}
    </li>
  );
}

function CommentContent({ cid }: { cid?: string }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(cid, Boolean(cid));

  if (!cid) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment supplied.</p>;
  }
  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Loading comment…</p>;
  }
  if (isError) {
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-destructive">Failed to load review comment.</p>
        <button className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (!data?.html?.body) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment content.</p>;
  }
  return (
    <article
      className="prose prose-xs mt-2 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: data.html.body }}
    />
  );
}
