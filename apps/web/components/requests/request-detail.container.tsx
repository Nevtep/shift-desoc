"use client";

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
import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { getContractConfig } from "../../lib/contracts";
import { isIpfsDocumentResponse, normalizeDateString } from "./helpers";
import { RequestDetailBody } from "./request-detail-body.component";
import { RequestDetailComments } from "./request-detail-comments.component";
import { RequestDetailDrafts } from "./request-detail-drafts.component";
import { RequestDetailHeader } from "./request-detail-header.component";
import type { CommentView, DraftView, RequestStatus } from "./types";
import { useToast } from "../ui/toaster";

export type RequestDetailProps = {
  requestId: string;
  expectedCommunityId?: number;
  requestListHref?: string;
  draftHrefBuilder?: (draft: DraftView) => string;
  draftHrefBasePath?: string;
};

type RequestDetailRequest = {
  id: number;
  communityId: number;
  author: string;
  status: RequestStatus;
  createdAt?: string | number | null;
  cid?: string | null;
  tags?: string[];
};

type StatusOption = { key: string; label: string; value: number };

type RequestQueryVars = { id: string };
type DraftsByRequestVars = { requestId: number; limit: number };
type CommentsByRequestVars = { requestId: number; limit: number; after?: string };

function normalizeRequestId(rawRequestId: string): string {
  let normalized = rawRequestId.trim();

  // Route params can arrive percent-encoded depending on navigation origin.
  // Decode until stable (max 2 passes) to handle accidental double-encoding.
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(normalized)) break;
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }

  return normalized;
}

function parseNativeId(value: string | number): number {
  if (typeof value === "number") return value;
  const normalized = value.trim();
  const candidate = normalized.includes(":") ? normalized.split(":").pop() ?? normalized : normalized;
  return Number(candidate);
}

export function RequestDetail({
  requestId,
  expectedCommunityId,
  requestListHref,
  draftHrefBuilder,
  draftHrefBasePath
}: RequestDetailProps) {
  const normalizedRequestId = useMemo(() => normalizeRequestId(requestId), [requestId]);
  const nativeRequestId = Number(
    normalizedRequestId.includes(":") ? normalizedRequestId.split(":").pop() : normalizedRequestId
  );
  const chainId = useChainId();
  const { address, status: accountStatus } = useAccount();
  const { writeContractAsync, isPending: isWriting, error: writeError } = useWriteContract();

  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(undefined);
  const [commentNodes, setCommentNodes] = useState<CommentView[]>([]);
  const [moderatingCommentId, setModeratingCommentId] = useState<string | null>(null);
  const [linkedValuableActionId, setLinkedValuableActionId] = useState<number | null>(null);
  const [bountyAmount, setBountyAmount] = useState<string>("0");
  const [linkDraft, setLinkDraft] = useState("");

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
  }, [normalizedRequestId]);

  const {
    data: requestData,
    isLoading,
    isError,
    refetch
  } = useGraphQLQuery<RequestQueryResult, RequestQueryVars>(
    ["request", normalizedRequestId],
    RequestQuery,
    { id: normalizedRequestId }
  );

  const { data: draftsData } = useGraphQLQuery<DraftsQueryResult, DraftsByRequestVars>(
    ["drafts", "request", normalizedRequestId],
    DraftsQuery,
    { requestId: nativeRequestId, limit: 20 }
  );

  const {
    data: commentsData,
    refetch: refetchComments
  } = useGraphQLQuery<CommentsByRequestResult, CommentsByRequestVars>(
    ["comments", "request", normalizedRequestId, commentsCursor ?? "start"],
    CommentsByRequestQuery,
    { requestId: nativeRequestId, limit: 10, after: commentsCursor ?? undefined }
  );

  const request = useMemo<RequestDetailRequest | null>(() => {
    if (!requestData?.request) return null;
    const resolvedId = Number(requestData.request.requestId ?? requestData.request.id);
    const resolvedCommunityId = Number(requestData.request.communityId);

    if (!Number.isFinite(resolvedId) || !Number.isFinite(resolvedCommunityId)) {
      return null;
    }

    return {
      ...requestData.request,
      id: resolvedId,
      communityId: resolvedCommunityId
    };
  }, [requestData?.request]);

  const isAuthor = useMemo(() => {
    if (!request || !address) return false;
    return request.author?.toLowerCase?.() === address.toLowerCase();
  }, [address, request]);

  const isRequestOpen = request?.status === "OPEN_DEBATE";

  const { modules } = useCommunityModules({
    communityId: request?.communityId,
    chainId,
    enabled: Boolean(request)
  });

  const requestHubAddress = modules?.requestHub;
  const requestHubAbi = COMMUNITY_MODULE_ABIS.requestHub;

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

  const cid = request?.cid ?? undefined;

  const {
    data: ipfsData,
    isLoading: isIpfsLoading,
    isError: isIpfsError,
    refetch: refetchIpfs
  } = useIpfsDocument(cid, Boolean(cid));

  const { data: onchainRequest } = useReadContract({
    address: requestHubAddress,
    abi: requestHubAbi as Abi,
    functionName: "getRequest",
    args: request ? [BigInt(request.id)] : undefined,
    chainId,
    query: {
      enabled: Boolean(requestHubAddress && request)
    }
  });

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

  useEffect(() => {
    if (!onchainRequest || !Array.isArray(onchainRequest)) return;

    const tuple = onchainRequest as unknown as [
      bigint,
      string,
      string,
      string,
      number,
      bigint,
      bigint,
      string[],
      bigint,
      bigint,
      bigint
    ];

    const bounty = tuple[9];
    const linked = tuple[10];

    setBountyAmount(bounty ? bounty.toString() : "0");

    const linkedNumeric = linked ? Number(linked) : 0;
    setLinkedValuableActionId(linkedNumeric > 0 ? linkedNumeric : null);
    if (!linkDraft && linkedNumeric > 0) {
      setLinkDraft(String(linkedNumeric));
    }
  }, [linkDraft, onchainRequest]);

  const { push } = useToast();

  const statusOptions: StatusOption[] = useMemo(
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

    const parentCommentId = replyTo ? parseNativeId(replyTo) : 0;
    if (!Number.isFinite(parentCommentId) || parentCommentId < 0) {
      setCommentError("Invalid parent comment.");
      return;
    }

    if (!requestHubAddress) {
      setCommentError("RequestHub module is not registered for this community.");
      return;
    }

    if (!isRequestOpen) {
      setCommentError("Comments are closed for this request.");
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
        address: requestHubAddress,
        abi: requestHubAbi,
        functionName: "postComment",
        args: [BigInt(request.id), BigInt(parentCommentId), uploadJson.cid]
      });

      setCommentNodes((prev) =>
        prev.map((comment) => (comment.id === optimisticId ? { ...comment, status: "confirmed" } : comment))
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
            comment.id === optimisticId ? { ...comment, status: "failed", error: message } : comment
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

    if (!requestHubAddress) {
      push("RequestHub module is not registered for this community.", "error");
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await writeContractAsync({
        address: requestHubAddress,
        abi: requestHubAbi,
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

  const handleModerateComment = async (commentId: string | number, hide: boolean) => {
    if (!requestHubAddress || !isModerator) {
      return;
    }

    const nativeCommentId = parseNativeId(commentId);
    if (!Number.isFinite(nativeCommentId) || nativeCommentId <= 0) {
      push("Invalid comment id.", "error");
      return;
    }

    try {
      setModeratingCommentId(String(commentId));
      await writeContractAsync({
        address: requestHubAddress,
        abi: requestHubAbi,
        functionName: "moderateComment",
        args: [BigInt(nativeCommentId), hide]
      });
      await refetchComments();
      push(hide ? "Comment hidden." : "Comment unhidden.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to moderate comment";
      push(message, "error");
    } finally {
      setModeratingCommentId(null);
    }
  };

  const handleLinkValuableAction = async () => {
    if (!request || !requestHubAddress) {
      push("Request not loaded", "error");
      return;
    }
    if (!isModerator && !isAuthor) {
      push("Only the author or a moderator can link a Valuable Action.", "error");
      return;
    }

    const vaIdNum = Number(linkDraft);
    if (!Number.isFinite(vaIdNum) || vaIdNum <= 0) {
      push("Enter a valid Valuable Action ID.", "error");
      return;
    }

    try {
      await writeContractAsync({
        address: requestHubAddress,
        abi: requestHubAbi,
        functionName: "linkValuableAction",
        args: [BigInt(request.id), BigInt(vaIdNum)]
      });
      setLinkedValuableActionId(vaIdNum);
      push(`Linked to Valuable Action ${vaIdNum}.`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to link Valuable Action";
      push(message, "error");
    }
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
      parentId: node.parentId ?? null,
      createdAt: normalizeDateString(node.createdAt) ?? (typeof node.createdAt === "string" ? node.createdAt : ""),
      isModerated: node.isModerated ?? false
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
  const hasHiddenComments = useMemo(() => comments.some((comment) => comment.isModerated), [comments]);
  const commentsPageInfo = commentsData?.comments.pageInfo;
  const commentDisabled = !isConnected || isSubmittingComment || isWriting || !requestHubAddress || !isRequestOpen;
  const drafts: DraftView[] = useMemo(
    () =>
      (draftsData?.drafts.nodes ?? []).map((node) => ({
        ...node,
        id: Number(node.id),
        requestId: Number(node.requestId)
      })),
    [draftsData]
  );

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

  const hasCommunityMismatch =
    Number.isFinite(expectedCommunityId) &&
    typeof expectedCommunityId === "number" &&
    expectedCommunityId > 0 &&
    request.communityId !== expectedCommunityId;

  const correctedRequestHref = hasCommunityMismatch
    ? `/communities/${request.communityId}/coordination/requests/${request.id}`
    : null;

  const createDraftHref = draftHrefBasePath
    ? `${draftHrefBasePath}/new?requestId=${request.id}`
    : `/communities/${request.communityId}/coordination/drafts/new?requestId=${request.id}`;

  return (
    <div className="space-y-8">
      {hasCommunityMismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This request belongs to Community #{request.communityId}, not Community #{expectedCommunityId}.{" "}
          {correctedRequestHref ? (
            <a className="underline" href={correctedRequestHref}>
              Open the correct route
            </a>
          ) : null}
        </div>
      ) : null}

      {requestListHref ? (
        <div className="text-sm">
          <a className="underline" href={requestListHref}>Back to requests</a>
        </div>
      ) : null}

      <RequestDetailHeader
        title={headerTitle}
        requestId={request.id}
        communityId={request.communityId}
        author={request.author}
        status={request.status}
        submittedAt={submittedAt}
        tags={request.tags}
        linkedValuableActionId={linkedValuableActionId}
        bountyAmount={bountyAmount}
        canLinkValuableAction={isModerator || isAuthor}
        linkDraft={linkDraft}
        onLinkDraftChange={setLinkDraft}
        onLinkValuableAction={handleLinkValuableAction}
        isWriting={isWriting}
        canModerate={isModerator}
        statusDraft={statusDraft}
        statusOptions={statusOptions}
        onStatusDraftChange={setStatusDraft}
        onStatusUpdate={handleStatusUpdate}
        isUpdatingStatus={isUpdatingStatus}
      />

      <RequestDetailBody
        cid={cid}
        hasRequestHubConfig={Boolean(requestHubAddress)}
        isIpfsLoading={isIpfsLoading}
        isIpfsError={isIpfsError}
        ipfsHtml={ipfsDoc?.html?.body ?? null}
        onRetryIpfs={refetchIpfs}
      />

      <RequestDetailDrafts
        drafts={drafts}
        draftHrefBuilder={draftHrefBuilder}
        draftHrefBasePath={draftHrefBasePath}
        createDraftHref={createDraftHref}
      />

      <RequestDetailComments
        comments={comments}
        replyTo={replyTo}
        onReplyChange={setReplyTo}
        commentBody={commentBody}
        onCommentBodyChange={setCommentBody}
        onSubmit={handleCommentSubmit}
        commentError={commentError}
        commentDisabled={commentDisabled}
        isSubmitting={isSubmittingComment}
        isWriting={isWriting}
        isRequestOpen={Boolean(isRequestOpen)}
        isModerator={isModerator}
        isConnected={isConnected}
        hasHiddenComments={hasHiddenComments}
        requestStatus={request.status}
        requestAuthor={request.author}
        currentAddress={address}
        moderatingCommentId={moderatingCommentId}
        onModerate={handleModerateComment}
        onLoadMore={() => {
          if (commentsPageInfo?.hasNextPage && commentsPageInfo?.endCursor) {
            setCommentsCursor(commentsPageInfo.endCursor);
          }
        }}
        hasMore={Boolean(commentsPageInfo?.hasNextPage)}
        unsupportedNetworkMessage={requestHubAddress ? null : "RequestHub module is not registered for this community."}
      />
    </div>
  );
}
