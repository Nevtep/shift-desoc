"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  CommentsByRequestQuery,
  DraftsQuery,
  RequestQuery,
  type CommentsByRequestResult,
  type DraftsQueryResult,
  type RequestQueryResult
} from "../../lib/graphql/queries";
import type { DraftNode } from "../drafts/draft-list";
import { useToast } from "../ui/toaster";

export type RequestDetailProps = {
  requestId: string;
};

export function RequestDetail({ requestId }: RequestDetailProps) {
  const numericId = Number(requestId);

  const {
    data: requestData,
    isLoading,
    isError,
    refetch
  } = useGraphQLQuery<RequestQueryResult>(["request", requestId], RequestQuery, { id: numericId });

  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(undefined);
  const [commentNodes, setCommentNodes] = useState<CommentsByRequestResult["comments"]["nodes"]>([]);

  useEffect(() => {
    setCommentsCursor(undefined);
    setCommentNodes([]);
  }, [numericId]);

  const { data: draftsData } = useGraphQLQuery<DraftsQueryResult>(
    ["drafts", "request", requestId],
    DraftsQuery,
    { requestId: numericId, limit: 20 }
  );

  const { data: commentsData } = useGraphQLQuery<CommentsByRequestResult>(
    ["comments", "request", requestId, commentsCursor ?? "start"],
    CommentsByRequestQuery,
    { requestId: numericId, limit: 10, after: commentsCursor ?? undefined }
  );

  const request = useMemo(() => {
    if (!requestData?.request) return null;
    return {
      ...requestData.request,
      id: Number(requestData.request.id),
      communityId: Number(requestData.request.communityId)
    };
  }, [requestData?.request]);

  const cid = request?.cid;

  const {
    data: ipfsData,
    isLoading: isIpfsLoading,
    isError: isIpfsError,
    refetch: refetchIpfs
  } = useIpfsDocument(cid, Boolean(cid));

  const displayTitle = useMemo(() => {
    const ipfsTitle =
      ipfsData?.data && "title" in ipfsData.data
        ? (ipfsData.data as { title?: string }).title
        : undefined;
    return ipfsTitle?.trim() || null;
  }, [ipfsData]);

  const headerTitle = displayTitle ?? (isIpfsLoading ? "Loading title…" : request ? `Request ${request.id}` : "Request");

  const submittedAt = useMemo(() => {
    const candidates = [request?.createdAt, ipfsData?.data?.createdAt];

    for (const value of candidates) {
      if (!value) continue;

      // ISO string
      if (typeof value === "string") {
        const iso = new Date(value);
        if (!Number.isNaN(iso.valueOf())) return iso;
      }

      // Numeric string or number (seconds or millis)
      const numeric = typeof value === "string" ? Number(value) : value;
      if (Number.isFinite(numeric)) {
        const d = new Date((numeric as number) < 1e12 ? (numeric as number) * 1000 : (numeric as number));
        if (!Number.isNaN(d.valueOf())) return d;
      }
    }

    return null;
  }, [ipfsData?.data?.createdAt, request?.createdAt]);

  const { push } = useToast();

  useEffect(() => {
    if (isError) {
      push("Failed to load request. Please retry.", "error");
    }
  }, [isError, push]);

  useEffect(() => {
    const nextNodes = commentsData?.comments.nodes ?? [];
    if (!nextNodes.length) return;
    setCommentNodes((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      const merged = [...prev];
      nextNodes.forEach((node) => {
        const numericId = Number(node.id);
        if (!seen.has(numericId)) {
          merged.push({ ...node, id: numericId });
          seen.add(numericId);
        }
      });
      return merged;
    });
  }, [commentsData]);

  const comments = useMemo(() => commentNodes, [commentNodes]);
  const commentsPageInfo = commentsData?.comments.pageInfo;

  const drafts = useMemo(() => {
    return (draftsData?.drafts.nodes ?? []).map((node) => ({
      ...node,
      id: Number(node.id),
      requestId: Number(node.requestId)
    })) as DraftNode[];
  }, [draftsData]);

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{headerTitle}</h2>
            <span className="text-xs text-muted-foreground">ID {request.id}</span>
          </div>
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
              <dd>{submittedAt ? submittedAt.toLocaleString() : "Unknown"}</dd>
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
        {drafts.length ? (
          <ul className="space-y-2 text-sm">
            {drafts.map((draft) => (
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
          <div className="space-y-2 text-sm">
            <ul className="space-y-2">
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
            <div className="flex items-center gap-3">
              {commentsPageInfo?.hasNextPage ? (
                <button
                  className="text-xs underline"
                  onClick={() => {
                    if (commentsPageInfo?.endCursor) {
                      setCommentsCursor(commentsPageInfo.endCursor);
                    }
                  }}
                >
                  Load more comments
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">No more comments.</span>
              )}
            </div>
          </div>
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
