"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  RequestQuery,
  type RequestQueryResult
} from "../../lib/graphql/queries";

export type RequestDetailProps = {
  requestId: string;
};

export function RequestDetail({ requestId }: RequestDetailProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<RequestQueryResult>(
    ["request", requestId],
    RequestQuery,
    { id: requestId }
  );

  const request = data?.request ?? null;
  const cid = request?.cid;

  const {
    data: ipfsData,
    isLoading: isIpfsLoading,
    isError: isIpfsError,
    refetch: refetchIpfs
  } = useIpfsDocument(cid, Boolean(cid));

  const comments = useMemo(() => request?.comments ?? [], [request]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading request…</p>;
  }

  if (isError || !request) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Failed to load request.</p>
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
              <dt className="font-medium text-foreground">Community</dt>
              <dd>{request.communityId}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Author</dt>
              <dd>{request.author}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Status</dt>
              <dd>{request.status}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Submitted</dt>
              <dd>{new Date(request.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          {request.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {request.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Discussion</h2>
          {cid ? (
            <a className="text-xs underline" href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer">
              View original document
            </a>
          ) : null}
        </div>
        {isIpfsLoading ? (
          <p className="text-sm text-muted-foreground">Loading content…</p>
        ) : isIpfsError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">Failed to load IPFS content.</p>
            <button className="text-xs underline" onClick={() => void refetchIpfs()}>
              Retry
            </button>
          </div>
        ) : ipfsData?.html?.body ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: ipfsData.html.body }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No markdown content available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Drafts</h2>
        {request.drafts?.length ? (
          <ul className="space-y-2 text-sm">
            {request.drafts.map((draft) => (
              <li key={draft.id} className="flex flex-wrap items-center gap-2">
                <Link className="underline" href={`/drafts/${draft.id}`}>
                  Draft {draft.id}
                </Link>
                <span className="text-muted-foreground">Status: {draft.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No drafts linked yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Comments</h2>
        {comments.length ? (
          <ul className="space-y-2 text-sm">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <CommentContent cid={comment.cid} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
      </section>
    </div>
  );
}

function CommentContent({ cid }: { cid: string }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(cid, Boolean(cid));

  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Loading comment…</p>;
  }
  if (isError) {
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-destructive">Failed to load comment content.</p>
        <button className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (!data?.html?.body) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment body provided.</p>;
  }
  return (
    <article
      className="prose prose-xs mt-2 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: data.html.body }}
    />
  );
}
