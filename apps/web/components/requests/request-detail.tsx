"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Abi } from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";

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
import { getContractConfig } from "../../lib/contracts";
import type { DraftNode } from "../drafts/draft-list";
import { useToast } from "../ui/toaster";

export type RequestDetailProps = {
  requestId: string;
};

type CommentView = CommentsByRequestResult["comments"]["nodes"][number] & {
  optimistic?: boolean;
  status?: "pending" | "confirmed" | "failed";
  error?: string;
};

export function RequestDetail({ requestId }: RequestDetailProps) {
  const numericId = Number(requestId);
  const chainId = useChainId();
  const { address, status: accountStatus } = useAccount();
  const { writeContractAsync, isPending: isWriting, error: writeError } = useWriteContract();

  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  type RequestQueryVars = { id: number };
  type DraftsByRequestVars = { requestId: number; limit: number };
  type CommentsByRequestVars = { requestId: number; limit: number; after?: string };

  const {
    data: requestData,
    isLoading,
    isError,
    refetch
  } = useGraphQLQuery<RequestQueryResult, RequestQueryVars>(["request", requestId], RequestQuery, { id: numericId });

  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(undefined);
  const [commentNodes, setCommentNodes] = useState<CommentView[]>([]);

  const requestHubConfig = useMemo(() => {
    try {
      return getContractConfig("requestHub", chainId);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [chainId]);

  const communityRegistryConfig = useMemo(() => {
    try {
      return getContractConfig("communityRegistry", chainId);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [chainId]);

  const isConnected = accountStatus === "connected";

  useEffect(() => {
    setCommentsCursor(undefined);
    setCommentNodes([]);
    setCommentBody("");
    setReplyTo(null);
    setCommentError(null);
  }, [numericId]);

  const { data: draftsData } = useGraphQLQuery<DraftsQueryResult, DraftsByRequestVars>(
    ["drafts", "request", requestId],
    DraftsQuery,
    { requestId: numericId, limit: 20 }
  );

  const {
    data: commentsData,
    refetch: refetchComments
  } = useGraphQLQuery<CommentsByRequestResult, CommentsByRequestVars>(
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

  const { data: moderatorRole } = useReadContract({
    address: communityRegistryConfig?.address,
    abi: (communityRegistryConfig?.abi ?? []) as Abi,
    functionName: "MODERATOR_ROLE",
    chainId,
    query: {
      enabled: Boolean(communityRegistryConfig)
    }
  });

  const { data: hasModeratorRole } = useReadContract({
    address: communityRegistryConfig?.address,
    abi: (communityRegistryConfig?.abi ?? []) as Abi,
    functionName: "hasRole",
    args:
      communityRegistryConfig && request && address && moderatorRole
        ? [BigInt(request.communityId), address, moderatorRole as `0x${string}`]
        : undefined,
    chainId,
    query: {
      enabled: Boolean(communityRegistryConfig && request && address && moderatorRole)
    }
  });

  const isModerator = Boolean(hasModeratorRole);

  const cid = request?.cid;

  const {
    data: ipfsData,
    isLoading: isIpfsLoading,
    isError: isIpfsError,
    refetch: refetchIpfs
  } = useIpfsDocument(cid, Boolean(cid));

  const ipfsDoc = useMemo(() => (isIpfsDocumentResponse(ipfsData) ? ipfsData : null), [ipfsData]);
  const ipfsMetadata = useMemo(() => {
    if (!ipfsDoc?.data || typeof ipfsDoc.data !== "object") return null;
    return ipfsDoc.data as { title?: string; createdAt?: unknown };
  }, [ipfsDoc]);

  const displayTitle = useMemo(() => {
    const ipfsTitle = ipfsMetadata?.title;
    return ipfsTitle?.trim() || null;
  }, [ipfsMetadata]);

  const headerTitle = displayTitle ?? (isIpfsLoading ? "Loading title…" : request ? `Request ${request.id}` : "Request");

  const submittedAt = useMemo(() => {
    const candidates = [request?.createdAt, ipfsMetadata?.createdAt];

    for (const value of candidates) {
      if (!value) continue;

      if (typeof value === "string") {
        const iso = new Date(value);
        if (!Number.isNaN(iso.valueOf())) return iso;
      }

      const numeric = typeof value === "string" ? Number(value) : value;
      if (Number.isFinite(numeric)) {
        const d = new Date((numeric as number) < 1e12 ? (numeric as number) * 1000 : (numeric as number));
        if (!Number.isNaN(d.valueOf())) return d;
      }
    }

    return null;
  }, [ipfsMetadata?.createdAt, request?.createdAt]);

  useEffect(() => {
    setStatusDraft(request?.status ?? null);
  }, [request?.status]);

  const { push } = useToast();

  const statusOptions = useMemo(
    () => [
      { key: "OPEN_DEBATE", label: "Open debate", value: 0 },
      { key: "FROZEN", label: "Frozen", value: 1 },
      { key: "ARCHIVED", label: "Archived", value: 2 }
    ],
    []
  );

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentError(null);

    if (!request) {
      setCommentError("Request is not loaded.");
      return;
    }

    if (!isConnected || !address) {
      setCommentError("Connect a wallet to comment.");
      return;
    }

    const trimmed = commentBody.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    const parentCommentId = replyTo ? Number(replyTo) : 0;
    if (!Number.isFinite(parentCommentId) || parentCommentId < 0) {
      setCommentError("Invalid parent comment.");
      return;
    }

    if (!requestHubConfig) {
      setCommentError("Unsupported network. Switch to Base Sepolia.");
      return;
    }

    let optimisticId: string | null = null;

    try {
      setIsSubmittingComment(true);

      const uploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            type: "comment",
            version: "1",
            bodyMarkdown: trimmed,
            requestId: request.id,
            parentId: parentCommentId || null,
            createdBy: address,
            createdAt: new Date().toISOString()
          }
        })
      });

      const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.cid) {
        throw new Error(uploadJson.error ?? "Failed to upload content to IPFS");
      }

      optimisticId = `pending-${Date.now()}`;
      const optimisticComment: CommentView = {
        id: optimisticId,
        requestId: request.id,
        author: address,
        cid: uploadJson.cid,
        parentId: parentCommentId || null,
        createdAt: new Date().toISOString(),
        optimistic: true,
        status: "pending"
      };

      setCommentNodes((prev) => [optimisticComment, ...prev]);

      await writeContractAsync({
        address: requestHubConfig.address,
        abi: requestHubConfig.abi,
        functionName: "postComment",
        args: [BigInt(request.id), BigInt(parentCommentId), uploadJson.cid]
      });

      setCommentNodes((prev) =>
        prev.map((comment) =>
          comment.id === optimisticId ? { ...comment, status: "confirmed" } : comment
        )
      );

      setCommentBody("");
      setReplyTo(null);
      await refetchComments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post comment";
      setCommentError(message);

      if (optimisticId) {
        setCommentNodes((prev) =>
          prev.map((comment) =>
            comment.id === optimisticId
              ? { ...comment, status: "failed", error: message }
              : comment
          )
        );
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!request || !isModerator) {
      return;
    }

    const nextStatus = statusOptions.find((option) => option.key === statusDraft) ?? statusOptions[0];

    if (!requestHubConfig) {
      push("Unsupported network. Switch to Base Sepolia.", "error");
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await writeContractAsync({
        address: requestHubConfig.address,
        abi: requestHubConfig.abi,
        functionName: "setRequestStatus",
        args: [BigInt(request.id), nextStatus.value]
      });

      await refetch();
      await refetchComments();
      push(`Status updated to ${nextStatus.label}.`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      push(message, "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const commentTree = useMemo(() => {
    const map = new Map<string, CommentView[]>();

    commentNodes.forEach((comment) => {
      const key = comment.parentId ? String(comment.parentId) : "root";
      const list = map.get(key) ?? [];
      list.push(comment);
      map.set(key, list);
    });

    map.forEach((list, key) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt ?? "").valueOf() - new Date(a.createdAt ?? "").valueOf());
      map.set(key, sorted);
    });

    return map;
  }, [commentNodes]);

  const renderCommentTree = (parentKey: string, depth = 0): JSX.Element | null => {
    const list = commentTree.get(parentKey) ?? [];
    if (!list.length) return null;

    return (
      <ul className="space-y-2">
        {list.map((comment) => (
          <li key={comment.id} className={`rounded border border-border p-3 ${depth ? "ml-4" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{comment.author}</span>
                {comment.status === "pending" ? (
                  <span className="text-xs text-amber-600">Pending…</span>
                ) : null}
                {comment.status === "failed" ? (
                  <span className="text-xs text-destructive">Failed</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(comment.createdAt)}</span>
                <button className="underline" onClick={() => setReplyTo(String(comment.id))}>
                  Reply
                </button>
              </div>
            </div>
            <CommentContent cid={comment.cid} />
            {renderCommentTree(String(comment.id), depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  useEffect(() => {
    if (isError) {
      push("Failed to load request. Please retry.", "error");
    }
  }, [isError, push]);

  useEffect(() => {
    const nextNodes = (commentsData?.comments.nodes ?? []).map((node) => ({
      ...node,
      id: String(node.id),
      requestId: Number(node.requestId),
      parentId: node.parentId ?? null
    }));

    if (!nextNodes.length) {
      setCommentNodes((prev) => prev.filter((comment) => comment.optimistic));
      return;
    }

    setCommentNodes((prev) => {
      const optimistic = prev.filter((comment) => comment.optimistic);
      const filteredOptimistic = optimistic.filter((comment) => {
        return !nextNodes.some((node) => {
          const sameCid = node.cid === comment.cid;
          const sameAuthor = node.author?.toLowerCase?.() === comment.author?.toLowerCase?.();
          return sameCid && sameAuthor;
        });
      });

      return [...filteredOptimistic, ...nextNodes];
    });
  }, [commentsData]);

  const comments = useMemo(() => commentNodes, [commentNodes]);
  const commentsPageInfo = commentsData?.comments.pageInfo;
  const commentDisabled = !isConnected || isSubmittingComment || isWriting || !requestHubConfig;
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
          {isModerator ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Moderation:</span>
              <select
                value={statusDraft ?? statusOptions[0]?.key}
                onChange={(e) => setStatusDraft(e.target.value)}
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
                onClick={() => void handleStatusUpdate()}
                disabled={isUpdatingStatus || isWriting}
                className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {isUpdatingStatus ? "Updating…" : "Update status"}
              </button>
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
        ) : ipfsDoc?.html?.body ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: ipfsDoc.html.body }}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Comments</h2>
          {!isConnected ? (
            <span className="text-xs text-muted-foreground">Connect a wallet to comment.</span>
          ) : null}
        </div>

        <form onSubmit={handleCommentSubmit} className="space-y-2">
          {replyTo ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Replying to comment #{replyTo}</span>
              <button type="button" className="underline" onClick={() => setReplyTo(null)}>
                Cancel reply
              </button>
            </div>
          ) : null}
          <textarea
            required
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            disabled={commentDisabled}
            className="min-h-[140px] w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Share context, feedback, or links to evidence"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={commentDisabled}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isSubmittingComment ? "Posting…" : "Post comment"}
            </button>
            {commentError ? <span className="text-xs text-destructive">{commentError}</span> : null}
            {!commentError && writeError ? (
              <span className="text-xs text-destructive">{writeError.message ?? "Transaction failed"}</span>
            ) : null}
            {commentDisabled && requestHubConfig === null ? (
              <span className="text-xs text-destructive">Unsupported network.</span>
            ) : null}
          </div>
        </form>

        {comments.length ? (
          <div className="space-y-2 text-sm">
            {renderCommentTree("root") ?? <p className="text-sm text-muted-foreground">No threaded comments.</p>}
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
                <span className="text-xs text-muted-foreground">End of thread.</span>
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
  const commentDoc = isIpfsDocumentResponse(data) ? data : null;

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
  if (!commentDoc?.html?.body) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment body provided.</p>;
  }
  return (
    <article
      className="prose prose-xs mt-2 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: commentDoc.html.body }}
    />
  );
}

function isIpfsDocumentResponse(value: unknown): value is {
  cid: string;
  html: { body: string } | null;
  data: unknown;
  type: string;
  version: string;
  retrievedAt: string;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { cid?: unknown; html?: unknown; data?: unknown; type?: unknown; version?: unknown; retrievedAt?: unknown };
  return Boolean(
    candidate.cid &&
    "html" in candidate &&
    "data" in candidate &&
    candidate.type &&
    candidate.version &&
    candidate.retrievedAt
  );
}

function formatDate(value?: string | number | null) {
  if (value === null || value === undefined) return "Unknown";

  if (typeof value === "string") {
    const iso = new Date(value);
    if (!Number.isNaN(iso.valueOf())) return iso.toLocaleString();
  }

  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isFinite(numeric)) {
    const d = new Date((numeric as number) < 1e12 ? (numeric as number) * 1000 : (numeric as number));
    if (!Number.isNaN(d.valueOf())) return d.toLocaleString();
  }

  return "Unknown";
}
