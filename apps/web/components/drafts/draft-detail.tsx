"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useRouter } from "next/navigation";
import { decodeEventLog, type AbiFunction, type Address, type Hash, type Hex } from "viem";

import { useApiQuery } from "../../hooks/useApiQuery";
import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { computeActionsHash } from "../../lib/actions/bundle-hash";
import { DraftsQuery, type DraftsQueryResult } from "../../lib/graphql/queries";
import type { DraftNode } from "./draft-list";

type DraftVersionNode = {
  id: string;
  cid: string;
  contributor: string;
  createdAt: string;
  source?: "snapshot" | "request-draft";
};

type DraftReviewNode = {
  id: string;
  reviewer: string;
  stance: string;
  commentCid?: string | null;
  createdAt: string;
};

type DraftDetailResponse = {
  draft: (DraftNode & {
    communityId?: number;
    targets?: string[];
    values?: string[];
    calldatas?: string[];
    actionsHash?: string | null;
    actions?: {
      targets?: string[];
      values?: string[];
      calldatas?: string[];
      actionsHash?: string | null;
    } | null;
    versions?: DraftVersionNode[];
    reviews?: DraftReviewNode[];
  }) | null;
};

export type DraftDetailProps = {
  draftId: string;
  expectedCommunityId?: number;
  draftsListHref?: string;
  requestHrefBuilder?: (requestId: number, communityId: number) => string;
  useCommunityScopedRequestLinks?: boolean;
};

export function DraftDetail({
  draftId,
  expectedCommunityId,
  draftsListHref,
  requestHrefBuilder,
  useCommunityScopedRequestLinks
}: DraftDetailProps) {
  const chainId = useChainId();
  const { data, isLoading, isError, refetch } = useApiQuery<DraftDetailResponse>(
    ["draft", draftId],
    `/drafts/${draftId}`
  );

  const draft = data?.draft ?? null;
  const latestCid = draft?.latestVersionCid ?? undefined;
  const indexedActionBundle = extractDraftActionBundle(draft);
  const nativeDraftId = parseNativeDraftId(draftId);
  const resolvedCommunityId = resolveCommunityId(draft?.communityId, expectedCommunityId);
  const { modules } = useCommunityModules({
    communityId: resolvedCommunityId,
    chainId,
    enabled: Boolean(resolvedCommunityId)
  });
  const draftsManagerAddress = modules?.draftsManager;

  const { data: onchainDraftRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "getDraft",
    args: nativeDraftId !== null ? [nativeDraftId] : undefined,
    query: {
      enabled: Boolean(draftsManagerAddress && nativeDraftId !== null && !indexedActionBundle.isComplete)
    }
  });

  const onchainDraft = useMemo(() => normalizeOnchainDraft(onchainDraftRaw), [onchainDraftRaw]);
  const actionBundle = useMemo(
    () => mergeActionBundles(indexedActionBundle, onchainDraft?.actions),
    [indexedActionBundle, onchainDraft]
  );
  const effectiveRequestId =
    toFiniteNumber(draft?.requestId) ?? toFiniteNumber(onchainDraft?.requestId) ?? 0;
  const shouldMergeRequestDrafts = effectiveRequestId > 0 && Boolean(resolvedCommunityId);

  const { data: relatedDraftsData } = useGraphQLQuery<DraftsQueryResult, { communityId: number; requestId: number; limit: number }>(
    ["drafts", "request-versions", resolvedCommunityId ?? 0, effectiveRequestId],
    DraftsQuery,
    {
      communityId: resolvedCommunityId ?? 0,
      requestId: effectiveRequestId,
      limit: 50
    },
    {
      enabled: shouldMergeRequestDrafts
    }
  );

  const {
    data: latestVersionRaw,
    isLoading: isLatestLoading,
    isError: isLatestError,
    refetch: refetchLatest
  } = useIpfsDocument(latestCid, Boolean(latestCid));

  const latestVersion = useMemo(
    () => (isIpfsDocumentResponse(latestVersionRaw) ? latestVersionRaw : null),
    [latestVersionRaw]
  );

  const versions = useMemo(() => {
    const baseVersions: DraftVersionNode[] = Array.isArray(draft?.versions)
      ? draft.versions.map((entry) => ({ ...entry, source: "snapshot" as const }))
      : [];

    if (!shouldMergeRequestDrafts) {
      return baseVersions;
    }

    const relatedDrafts = relatedDraftsData?.drafts?.nodes ?? [];
    const syntheticVersions = relatedDrafts
      .filter((node) => {
        const cid = typeof node.latestVersionCid === "string" ? node.latestVersionCid : "";
        return Boolean(cid);
      })
      .map((node) => ({
        id: `request-draft-${String(node.id)}`,
        cid: String(node.latestVersionCid),
        contributor: `Draft ${String(node.id)} (${node.status})`,
        createdAt: node.updatedAt,
        source: "request-draft" as const
      }));

    const merged = [...baseVersions, ...syntheticVersions];
    const seen = new Set<string>();

    const deduped = merged.filter((entry) => {
      const key = `${entry.cid}:${entry.createdAt}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return deduped.sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [draft, relatedDraftsData, shouldMergeRequestDrafts]);
  const reviews = useMemo(
    () => (Array.isArray(draft?.reviews) ? draft.reviews : []),
    [draft]
  );

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

  const draftCommunityId = draft.communityId ? Number(draft.communityId) : null;
  const hasCommunityMismatch =
    Number.isFinite(expectedCommunityId) &&
    typeof expectedCommunityId === "number" &&
    (expectedCommunityId ?? 0) > 0 &&
    Number.isFinite(draftCommunityId) &&
    draftCommunityId !== expectedCommunityId;

  const correctedDraftHref = hasCommunityMismatch
    ? `/communities/${draftCommunityId}/coordination/drafts/${draftId}`
    : null;

  return (
    <div className="space-y-8">
      {hasCommunityMismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This draft belongs to Community #{draftCommunityId}, not Community #{expectedCommunityId}.{" "}
          {correctedDraftHref ? (
            <a className="underline" href={correctedDraftHref}>
              Open the correct route
            </a>
          ) : null}
        </div>
      ) : null}

      {draftsListHref ? (
        <div className="text-sm">
          <a className="underline" href={draftsListHref}>Back to drafts</a>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="card">
          <h2 className="text-lg font-medium">Metadata</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <dt className="font-medium text-foreground">Request</dt>
              <dd>
                <Link
                  className="underline"
                  href={(
                    useCommunityScopedRequestLinks && Number.isFinite(draftCommunityId)
                      ? `/communities/${draftCommunityId}/coordination/requests/${effectiveRequestId}`
                      : requestHrefBuilder && typeof draftCommunityId === "number" && Number.isFinite(draftCommunityId)
                      ? requestHrefBuilder(effectiveRequestId, draftCommunityId)
                      : `/requests/${effectiveRequestId}`
                  ) as Route}
                >
                  {effectiveRequestId}
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
                  <Link
                    className="underline"
                    href={`/communities/${draftCommunityId ?? expectedCommunityId ?? 0}/governance/proposals/${draft.escalatedProposalId}` as Route}
                  >
                    {draft.escalatedProposalId}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <DraftActionBundleSection actionBundle={actionBundle} />
      </section>

      <section className="space-y-3">
        <DraftRevisionComposer
          draftId={draftId}
          nativeDraftId={nativeDraftId}
          communityId={draft.communityId ? Number(draft.communityId) : undefined}
          requestId={effectiveRequestId}
          status={draft.status}
          actionBundle={actionBundle}
        />
      </section>

      <section className="space-y-3">
        <DraftWorkflowActions
          draftId={draftId}
          nativeDraftId={nativeDraftId}
          status={draft.status}
          communityId={draft.communityId ? Number(draft.communityId) : undefined}
        />
      </section>

      <section className="space-y-3">
        <DraftEscalateForm
          draftId={draftId}
          nativeDraftId={nativeDraftId}
          communityId={draft.communityId ? Number(draft.communityId) : undefined}
          expectedCommunityId={expectedCommunityId}
          status={draft.status}
          hasActionBundle={actionBundle.isComplete}
          hasProposal={Boolean(draft.escalatedProposalId)}
        />
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
        {reviews.length ? (
          <ul className="space-y-2 text-sm">
            {reviews.map((review) => (
              <li key={review.id} className="card-tight">
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

function DraftEscalateForm({
  draftId,
  nativeDraftId,
  communityId,
  expectedCommunityId,
  status,
  hasActionBundle,
  hasProposal
}: {
  draftId: string;
  nativeDraftId: bigint | null;
  communityId?: number;
  expectedCommunityId?: number;
  status: string;
  hasActionBundle: boolean;
  hasProposal: boolean;
}) {
  const router = useRouter();
  const chainId = useChainId();
  const { status: accountStatus, address } = useAccount();
  const publicClient = usePublicClientCompat();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: Boolean(communityId) });
  const draftsManagerAddress = modules?.draftsManager;

  const [descriptionCid, setDescriptionCid] = useState("");
  const [descriptionMarkdown, setDescriptionMarkdown] = useState("");
  const [isMultiChoice, setIsMultiChoice] = useState(true);
  const [numOptions, setNumOptions] = useState(2);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isConnected = accountStatus === "connected";
  const isFinalized = String(status).toUpperCase() === "FINALIZED";
  const disabled = !isConnected || !isFinalized || isPending || isUploading || hasProposal;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    if (!descriptionCid && !descriptionMarkdown.trim()) {
      setFormError("Provide a description markdown body or an existing CID.");
      return;
    }
    if (!communityId || !draftsManagerAddress) {
      setFormError("DraftsManager module is not registered for this community.");
      return;
    }
    if (typeof expectedCommunityId === "number" && expectedCommunityId > 0 && expectedCommunityId !== communityId) {
      setFormError("Draft community does not match the active route community.");
      return;
    }
    if (nativeDraftId === null) {
      setFormError("Draft ID is invalid for on-chain escalation.");
      return;
    }
    if (!hasActionBundle) {
      setFormError("Draft action bundle is incomplete. Ensure targets, values, calldatas, and actionsHash are present.");
      return;
    }
    if (isMultiChoice && numOptions < 2) {
      setFormError("Multi-choice proposals require at least 2 options.");
      return;
    }

    let cidToUse = descriptionCid;
    try {
      if (!cidToUse) {
        setIsUploading(true);
        const res = await fetch("/api/ipfs/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: {
              type: "proposalDescription",
              body: descriptionMarkdown,
              createdBy: address,
              createdAt: new Date().toISOString()
            }
          })
        });
        const json = (await res.json()) as { cid?: string; error?: string };
        if (!res.ok || !json.cid) {
          throw new Error(json.error ?? "Failed to upload description");
        }
        cidToUse = json.cid;
      }

      const txHash = await writeContractAsync({
        address: draftsManagerAddress,
        abi: COMMUNITY_MODULE_ABIS.draftsManager,
        functionName: "escalateToProposal",
        args: [nativeDraftId, isMultiChoice, Number(numOptions), cidToUse]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const parsedProposalId = parseEscalatedProposalId(receipt.logs);
      const proposalsBase = `/communities/${communityId}/governance/proposals`;

      if (parsedProposalId) {
        setFormMessage(`Escalation confirmed. Proposal ${parsedProposalId} created.`);
        router.push(`${proposalsBase}/${parsedProposalId}` as never);
      } else {
        setFormMessage("Escalation confirmed. Proposal indexing may lag for a short period.");
        router.push(`${proposalsBase}?indexLag=1` as never);
      }
    } catch (err) {
      console.error(err);
      setFormError(formatDraftTxError(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Escalate to Proposal</h3>
          <p className="text-sm text-muted-foreground">
            Contract requires FINALIZED status; only authors/contributors may escalate.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Draft {draftId}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="text-xs text-muted-foreground sm:col-span-2">
          Current status: {status}
        </div>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Description CID (optional)</span>
          <input
            value={descriptionCid}
            onChange={(e) => setDescriptionCid(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Use existing CID or leave blank to upload markdown"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Description markdown</span>
          <textarea
            value={descriptionMarkdown}
            onChange={(e) => setDescriptionMarkdown(e.target.value)}
            className="min-h-[120px] rounded border border-border bg-background px-3 py-2"
            placeholder="Markdown will be pinned to IPFS if no CID is provided"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isMultiChoice}
            onChange={(e) => setIsMultiChoice(e.target.checked)}
          />
          <span className="text-muted-foreground">Multi-choice proposal</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Number of options</span>
          <input
            type="number"
            min={2}
            value={numOptions}
            onChange={(e) => setNumOptions(Number(e.target.value) || 2)}
            className="rounded border border-border bg-background px-3 py-2"
            disabled={!isMultiChoice}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled || !hasActionBundle}
          className="btn-primary"
        >
          {isPending || isUploading ? "Submitting..." : "Escalate"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to escalate.</span> : null}
        {!isFinalized ? <span className="text-xs text-muted-foreground">Draft must be FINALIZED before escalation.</span> : null}
        {hasProposal ? <span className="text-xs text-muted-foreground">Proposal already escalated.</span> : null}
        {!hasActionBundle ? <span className="text-xs text-destructive">Action bundle required before escalation.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {formMessage ? <span className="text-xs text-emerald-600">{formMessage}</span> : null}
        {formError ? <span className="text-xs text-destructive">{formError}</span> : null}
      </div>
    </form>
  );
}

function DraftActionBundleSection({
  actionBundle
}: {
  actionBundle: ReturnType<typeof mergeActionBundles>;
}) {
  const entries = actionBundle.targets.map((target, index) => ({
    target,
    value: actionBundle.values[index] ?? "0",
    calldata: actionBundle.calldatas[index] ?? "0x"
  }));

  return (
    <div className="card">
      <h2 className="text-lg font-medium">Queued Actions</h2>
      {actionBundle.isComplete ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">actionsHash: {actionBundle.actionsHash}</p>
          {actionBundle.source === "onchain" ? (
            <p className="text-xs text-amber-700">
              Indexed action bundle is incomplete. Displaying on-chain bundle from DraftsManager.
            </p>
          ) : null}
          <ul className="space-y-2">
            {entries.map((entry, index) => (
              <li key={`${entry.target}-${index}`} className="rounded border border-border p-2">
                <div className="text-xs text-muted-foreground">Action {index + 1}</div>
                <div className="font-mono text-xs break-all">target: {entry.target}</div>
                <div className="font-mono text-xs break-all">value: {entry.value}</div>
                <div className="font-mono text-xs break-all">calldata: {entry.calldata}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No complete action bundle is indexed for this draft yet.</p>
      )}
    </div>
  );
}

function DraftRevisionComposer({
  draftId,
  nativeDraftId,
  communityId,
  requestId,
  status,
  actionBundle
}: {
  draftId: string;
  nativeDraftId: bigint | null;
  communityId?: number;
  requestId: number;
  status: string;
  actionBundle: ReturnType<typeof mergeActionBundles>;
}) {
  const router = useRouter();
  const chainId = useChainId();
  const { status: accountStatus, address } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: Boolean(communityId) });
  const draftsManagerAddress = modules?.draftsManager;

  const isConnected = accountStatus === "connected";
  const isDrafting = String(status).toUpperCase() === "DRAFTING";

  const initialRows = useMemo(
    () =>
      actionBundle.targets.map((target, index) => ({
        target,
        value: actionBundle.values[index] ?? "0",
        calldata: actionBundle.calldatas[index] ?? "0x"
      })),
    [actionBundle]
  );

  const [rows, setRows] = useState<Array<{ target: string; value: string; calldata: string }>>(initialRows);
  const [versionCid, setVersionCid] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isDrafting) {
    return null;
  }

  function updateRow(index: number, next: Partial<{ target: string; value: string; calldata: string }>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...next } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { target: "", value: "0", calldata: "0x" }]);
  }

  async function handleCreateRevision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    if (!communityId || !draftsManagerAddress) {
      setFormError("DraftsManager module is not registered for this community.");
      return;
    }
    if (!Number.isFinite(requestId) || requestId < 0) {
      setFormError("Request ID is invalid for revision draft creation.");
      return;
    }
    if (!versionCid && !markdown.trim()) {
      setFormError("Provide revision markdown content or an existing CID.");
      return;
    }

    const parsedTargets: Address[] = [];
    const parsedValues: bigint[] = [];
    const parsedCalldatas: Hex[] = [];

    for (const row of rows) {
      const target = row.target.trim();
      const calldata = row.calldata.trim() || "0x";
      const value = row.value.trim() || "0";

      if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
        setFormError(`Invalid target address: ${target || "(empty)"}`);
        return;
      }
      if (!/^0x([a-fA-F0-9]{2})*$/.test(calldata)) {
        setFormError(`Invalid calldata hex for target ${target}.`);
        return;
      }

      try {
        parsedTargets.push(target as Address);
        parsedValues.push(BigInt(value));
        parsedCalldatas.push(calldata as Hex);
      } catch {
        setFormError(`Invalid action value for target ${target}.`);
        return;
      }
    }

    if (!parsedTargets.length) {
      setFormError("Add at least one action before creating a revised draft.");
      return;
    }

    let cidToUse = versionCid;
    try {
      if (!cidToUse) {
        setIsUploading(true);
        const uploadRes = await fetch("/api/ipfs/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: {
              version: "1",
              type: "draftVersion",
              draftId,
              author: address ?? "unknown",
              bodyMarkdown: markdown,
              changelog: ["Revised action queue before review submission"],
              actionBundlePreview: {
                targets: parsedTargets,
                values: parsedValues.map((value) => value.toString()),
                signatures: parsedCalldatas
              },
              createdBy: address,
              createdAt: new Date().toISOString()
            }
          })
        });
        const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
        if (!uploadRes.ok || !uploadJson.cid) {
          throw new Error(uploadJson.error ?? "Failed to upload revised draft content");
        }
        cidToUse = uploadJson.cid;
      }

      const actionHash = computeActionsHash(parsedTargets, parsedValues, parsedCalldatas);
      const actionBundlePayload = {
        targets: parsedTargets,
        values: parsedValues,
        calldatas: parsedCalldatas,
        actionsHash: actionHash
      };

      const createDraftInputCount = getCreateDraftInputCount();
      const args =
        createDraftInputCount === 3
          ? [BigInt(requestId), actionBundlePayload, cidToUse]
          : createDraftInputCount === 4
            ? [BigInt(communityId), BigInt(requestId), actionBundlePayload, cidToUse]
            : null;

      if (!args || args.length !== createDraftInputCount) {
        throw new Error(
          `DraftsManager createDraft ABI mismatch: expected ${createDraftInputCount} args but built ${args?.length ?? 0}`
        );
      }

      await writeContractAsync({
        address: draftsManagerAddress,
        abi: COMMUNITY_MODULE_ABIS.draftsManager,
        functionName: "createDraft",
        args
      });

      setMessage("Revised draft created. The original draft is unchanged.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError(formatDraftTxError(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleCreateRevision} className="card">
      <h2 className="text-lg font-medium">Revise Queue Before Review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Draft action bundles are immutable on-chain. Editing the queue creates a revised draft and keeps the original draft unchanged.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.target}-${index}`} className="rounded border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Target</span>
                <input
                  value={row.target}
                  onChange={(e) => updateRow(index, { target: e.target.value })}
                  className="rounded border border-border bg-background px-2 py-1"
                  placeholder="0x..."
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Value</span>
                <input
                  value={row.value}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  className="rounded border border-border bg-background px-2 py-1"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Calldata</span>
                <input
                  value={row.calldata}
                  onChange={(e) => updateRow(index, { calldata: e.target.value })}
                  className="rounded border border-border bg-background px-2 py-1"
                  placeholder="0x"
                />
              </label>
            </div>
            <button
              type="button"
              className="mt-2 text-xs underline"
              onClick={() => removeRow(index)}
            >
              Remove action
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button type="button" className="text-sm underline" onClick={addRow}>
          Add action
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Revision CID (optional)</span>
          <input
            value={versionCid}
            onChange={(e) => setVersionCid(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Use existing CID or leave blank"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Revision markdown</span>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="min-h-[120px] rounded border border-border bg-background px-3 py-2"
            placeholder="Describe queue/metadata updates for this revision"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isConnected || isPending || isUploading || !communityId || nativeDraftId === null}
          className="btn-secondary"
        >
          {isPending || isUploading ? "Submitting..." : "Create revised draft"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to create a revision.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {message ? <span className="text-xs text-emerald-600">{message}</span> : null}
        {formError ? <span className="text-xs text-destructive">{formError}</span> : null}
      </div>
    </form>
  );
}

function DraftWorkflowActions({
  draftId,
  nativeDraftId,
  status,
  communityId
}: {
  draftId: string;
  nativeDraftId: bigint | null;
  status: string;
  communityId?: number;
}) {
  const chainId = useChainId();
  const { status: accountStatus, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: Boolean(communityId) });
  const draftsManagerAddress = modules?.draftsManager;

  const { data: workflowDraftRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "getDraft",
    args: nativeDraftId !== null ? [nativeDraftId] : undefined,
    query: {
      enabled: Boolean(draftsManagerAddress && nativeDraftId !== null)
    }
  });

  const { data: reviewPeriodRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "reviewPeriod",
    query: {
      enabled: Boolean(draftsManagerAddress)
    }
  });

  const { data: minReviewsRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "minReviewsForEscalation",
    query: {
      enabled: Boolean(draftsManagerAddress)
    }
  });

  const { data: supportThresholdRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "supportThresholdBps",
    query: {
      enabled: Boolean(draftsManagerAddress)
    }
  });

  const { data: reviewSummaryRaw } = useReadContract({
    address: draftsManagerAddress,
    abi: COMMUNITY_MODULE_ABIS.draftsManager,
    functionName: "getReviewSummary",
    args: nativeDraftId !== null ? [nativeDraftId] : undefined,
    query: {
      enabled: Boolean(draftsManagerAddress && nativeDraftId !== null)
    }
  });

  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const normalizedStatus = String(status).toUpperCase();
  const canSubmitForReview = normalizedStatus === "DRAFTING";
  const canFinalize = normalizedStatus === "REVIEW";
  const isConnected = accountStatus === "connected";

  const finalizeGuards = useMemo(
    () =>
      deriveFinalizeGuards({
        workflowDraftRaw,
        reviewPeriodRaw,
        minReviewsRaw,
        supportThresholdRaw,
        reviewSummaryRaw
      }),
    [workflowDraftRaw, reviewPeriodRaw, minReviewsRaw, supportThresholdRaw, reviewSummaryRaw]
  );

  const disableFinalizeForGuards = canFinalize && finalizeGuards.isKnown && !finalizeGuards.allPassed;

  if (!canSubmitForReview && !canFinalize) {
    return null;
  }

  async function runWorkflowAction(action: "submitForReview" | "finalizeForProposal") {
    setMessage(null);
    setFormError(null);

    if (!nativeDraftId) {
      setFormError("Draft ID is invalid for on-chain workflow actions.");
      return;
    }
    if (!draftsManagerAddress) {
      setFormError("DraftsManager module is not registered for this community.");
      return;
    }

    try {
      const gas = await resolveDraftWorkflowGasLimit({
        publicClient,
        account: address,
        draftsManagerAddress,
        functionName: action,
        args: [nativeDraftId],
      });

      const txHash = await writeContractAsync({
        address: draftsManagerAddress,
        abi: COMMUNITY_MODULE_ABIS.draftsManager,
        functionName: action,
        args: [nativeDraftId],
        ...(gas ? { gas } : {})
      });

      await assertDraftWorkflowReceiptSuccess(publicClient, txHash);

      setMessage(
        action === "submitForReview"
          ? "Draft submitted for review."
          : "Draft finalized for proposal escalation."
      );
    } catch (err) {
      console.error(err);
      setFormError(formatDraftTxError(err));
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-medium">Draft Workflow</h2>
      <p className="mt-1 text-sm text-muted-foreground">Draft {draftId} is currently {status}.</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canSubmitForReview ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={!isConnected || isPending}
            onClick={() => void runWorkflowAction("submitForReview")}
          >
            {isPending ? "Submitting..." : "Submit for review"}
          </button>
        ) : null}
        {canFinalize ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={!isConnected || isPending || disableFinalizeForGuards}
            onClick={() => void runWorkflowAction("finalizeForProposal")}
          >
            {isPending ? "Submitting..." : "Finalize for proposal"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to continue draft workflow.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {message ? <span className="text-xs text-emerald-600">{message}</span> : null}
        {formError ? <span className="text-xs text-destructive">{formError}</span> : null}
      </div>

      {canFinalize ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Finalize requirements</p>
          <p>
            Review period: {finalizeGuards.reviewPeriodLabel}
            {finalizeGuards.remainingPeriodLabel ? ` (${finalizeGuards.remainingPeriodLabel})` : ""}
          </p>
          <p>
            Reviews: {finalizeGuards.totalReviewsLabel}
            {finalizeGuards.minReviewsLabel ? ` / ${finalizeGuards.minReviewsLabel}` : ""}
          </p>
          <p>
            Support: {finalizeGuards.supportLabel}
            {finalizeGuards.supportThresholdLabel ? ` / ${finalizeGuards.supportThresholdLabel}` : ""}
          </p>
          {disableFinalizeForGuards ? (
            <p className="text-destructive">Finalize is blocked until all review requirements are met.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function deriveFinalizeGuards({
  workflowDraftRaw,
  reviewPeriodRaw,
  minReviewsRaw,
  supportThresholdRaw,
  reviewSummaryRaw,
}: {
  workflowDraftRaw: unknown;
  reviewPeriodRaw: unknown;
  minReviewsRaw: unknown;
  supportThresholdRaw: unknown;
  reviewSummaryRaw: unknown;
}) {
  const reviewStartedAt = extractReviewStartedAt(workflowDraftRaw);
  const reviewPeriod = toBigIntOrNull(reviewPeriodRaw);
  const minReviews = toBigIntOrNull(minReviewsRaw);
  const supportThresholdBps = toBigIntOrNull(supportThresholdRaw);

  const summaryTuple = reviewSummaryRaw as
    | { supportCount?: unknown; totalReviews?: unknown; [index: number]: unknown }
    | undefined;
  const supportCount = toBigIntOrNull(summaryTuple?.supportCount ?? summaryTuple?.[0]);
  const totalReviews = toBigIntOrNull(summaryTuple?.totalReviews ?? summaryTuple?.[4]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = reviewStartedAt !== null && now > reviewStartedAt ? now - reviewStartedAt : 0n;
  const remainingPeriod = reviewPeriod !== null ? (elapsed >= reviewPeriod ? 0n : reviewPeriod - elapsed) : null;

  const reviewPeriodMet = remainingPeriod !== null ? remainingPeriod === 0n : null;
  const minReviewsMet = totalReviews !== null && minReviews !== null ? totalReviews >= minReviews : null;

  const supportBps =
    supportCount !== null && totalReviews !== null && totalReviews > 0n
      ? (supportCount * 10000n) / totalReviews
      : null;
  const supportMet = supportBps !== null && supportThresholdBps !== null ? supportBps >= supportThresholdBps : null;

  const knownChecks = [reviewPeriodMet, minReviewsMet, supportMet].filter((v): v is boolean => v !== null);
  const isKnown = knownChecks.length > 0;

  return {
    isKnown,
    allPassed: isKnown ? knownChecks.every(Boolean) : true,
    reviewPeriodLabel: reviewPeriod !== null ? formatDurationCompact(reviewPeriod) : "unknown",
    remainingPeriodLabel:
      remainingPeriod !== null && remainingPeriod > 0n
        ? `remaining ${formatDurationCompact(remainingPeriod)}`
        : reviewPeriodMet === true
          ? "met"
          : null,
    totalReviewsLabel: totalReviews !== null ? totalReviews.toString() : "unknown",
    minReviewsLabel: minReviews !== null ? minReviews.toString() : null,
    supportLabel: supportBps !== null ? formatBpsPercent(supportBps) : "unknown",
    supportThresholdLabel: supportThresholdBps !== null ? formatBpsPercent(supportThresholdBps) : null,
  };
}

function extractReviewStartedAt(workflowDraftRaw: unknown) {
  const tuple = workflowDraftRaw as { reviewStartedAt?: unknown; [index: number]: unknown } | undefined;
  return toBigIntOrNull(tuple?.reviewStartedAt ?? tuple?.[8]);
}

function toBigIntOrNull(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function formatDurationCompact(secondsInput: bigint) {
  const seconds = secondsInput < 0n ? 0n : secondsInput;
  const day = 86400n;
  const hour = 3600n;
  const minute = 60n;

  const days = seconds / day;
  const hours = (seconds % day) / hour;
  const minutes = (seconds % hour) / minute;

  if (days > 0n) return `${days.toString()}d ${hours.toString()}h`;
  if (hours > 0n) return `${hours.toString()}h ${minutes.toString()}m`;
  return `${(seconds / minute).toString()}m`;
}

function formatBpsPercent(bps: bigint) {
  const integer = bps / 100n;
  const decimals = bps % 100n;
  return `${integer.toString()}.${decimals.toString().padStart(2, "0")}%`;
}

const DRAFT_WORKFLOW_GAS_CAP = 1_500_000n;
const DRAFT_WORKFLOW_GAS_FALLBACK = 900_000n;

async function assertDraftWorkflowReceiptSuccess(
  publicClient: ReturnType<typeof usePublicClient>,
  txHash: Hash
) {
  if (!publicClient) {
    throw new Error("Unable to verify transaction confirmation for draft workflow action.");
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction execution reverted on-chain (${txHash}).`);
  }
}

async function resolveDraftWorkflowGasLimit({
  publicClient,
  account,
  draftsManagerAddress,
  functionName,
  args,
}: {
  publicClient: ReturnType<typeof usePublicClient>;
  account?: `0x${string}`;
  draftsManagerAddress: `0x${string}`;
  functionName: "submitForReview" | "finalizeForProposal";
  args: [bigint];
}) {
  if (!publicClient || !account) {
    return DRAFT_WORKFLOW_GAS_FALLBACK;
  }

  try {
    const estimate = await publicClient.estimateContractGas({
      account,
      address: draftsManagerAddress,
      abi: COMMUNITY_MODULE_ABIS.draftsManager,
      functionName,
      args,
    });

    const padded = (estimate * 12n) / 10n;
    return padded > DRAFT_WORKFLOW_GAS_CAP ? DRAFT_WORKFLOW_GAS_CAP : padded;
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (message.includes("exceeds max transaction gas limit")) {
      return DRAFT_WORKFLOW_GAS_FALLBACK;
    }
    return DRAFT_WORKFLOW_GAS_FALLBACK;
  }
}

function extractDraftActionBundle(draft: DraftDetailResponse["draft"]) {
  const fallback = {
    targets: draft?.targets,
    values: draft?.values,
    calldatas: draft?.calldatas,
    actionsHash: draft?.actionsHash
  };
  const nested = draft?.actions ?? null;
  const source = nested ?? fallback;

  const targets = Array.isArray(source?.targets) ? source.targets : [];
  const values = Array.isArray(source?.values) ? source.values : [];
  const calldatas = Array.isArray(source?.calldatas) ? source.calldatas : [];
  const actionsHash = typeof source?.actionsHash === "string" ? source.actionsHash : null;

  return {
    targets,
    values,
    calldatas,
    actionsHash,
    isComplete: Boolean(actionsHash) && targets.length > 0 && values.length > 0 && calldatas.length > 0,
    source: "indexed" as const
  };
}

function mergeActionBundles(
  indexedActionBundle: ReturnType<typeof extractDraftActionBundle>,
  onchainActions?: { targets: string[]; values: string[]; calldatas: string[]; actionsHash: string | null }
) {
  if (indexedActionBundle.isComplete) {
    return indexedActionBundle;
  }

  const fallbackComplete =
    Boolean(onchainActions?.actionsHash) &&
    Boolean(onchainActions?.targets.length) &&
    Boolean(onchainActions?.values.length) &&
    Boolean(onchainActions?.calldatas.length);

  if (!fallbackComplete || !onchainActions) {
    return indexedActionBundle;
  }

  return {
    ...onchainActions,
    isComplete: true,
    source: "onchain" as const
  };
}

function normalizeOnchainDraft(raw: unknown): {
  requestId: number | null;
  actions: { targets: string[]; values: string[]; calldatas: string[]; actionsHash: string | null };
} | null {
  if (!raw) return null;

  const tuple = raw as {
    requestId?: bigint | number | string;
    actions?: {
      targets?: unknown[];
      values?: unknown[];
      calldatas?: unknown[];
      actionsHash?: unknown;
    };
    [key: number]: unknown;
  };

  const requestIdRaw = tuple.requestId ?? tuple[1];
  const requestId = toFiniteNumber(requestIdRaw);

  const actionsTuple = (tuple.actions ?? tuple[4] ?? {}) as {
    targets?: unknown[];
    values?: unknown[];
    calldatas?: unknown[];
    actionsHash?: unknown;
    [key: number]: unknown;
  };

  const targetsRaw = (actionsTuple.targets ?? actionsTuple[0] ?? []) as unknown[];
  const valuesRaw = (actionsTuple.values ?? actionsTuple[1] ?? []) as unknown[];
  const calldatasRaw = (actionsTuple.calldatas ?? actionsTuple[2] ?? []) as unknown[];
  const hashRaw = actionsTuple.actionsHash ?? actionsTuple[3] ?? null;

  return {
    requestId,
    actions: {
      targets: targetsRaw.map((value) => String(value)),
      values: valuesRaw.map((value) => String(value)),
      calldatas: calldatasRaw.map((value) => String(value)),
      actionsHash: typeof hashRaw === "string" ? hashRaw : null
    }
  };
}

function resolveCommunityId(draftCommunityId?: number, expectedCommunityId?: number) {
  if (Number.isFinite(draftCommunityId) && (draftCommunityId ?? 0) > 0) {
    return Number(draftCommunityId);
  }
  if (Number.isFinite(expectedCommunityId) && (expectedCommunityId ?? 0) > 0) {
    return Number(expectedCommunityId);
  }
  return undefined;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function getCreateDraftInputCount() {
  const fn = COMMUNITY_MODULE_ABIS.draftsManager.find(
    (item): item is AbiFunction => item.type === "function" && item.name === "createDraft"
  );
  if (!fn) {
    throw new Error("DraftsManager ABI missing createDraft");
  }
  return fn.inputs.length;
}

function parseNativeDraftId(draftId: string): bigint | null {
  const normalized = String(draftId).trim();
  if (!normalized) return null;

  const candidate = normalized.includes(":") ? normalized.split(":").pop() ?? normalized : normalized;
  if (!/^\d+$/.test(candidate)) return null;

  try {
    return BigInt(candidate);
  } catch {
    return null;
  }
}

type VersionNode = {
  id: string;
  cid: string;
  contributor: string;
  createdAt: string;
};

function VersionEntry({ version }: { version: VersionNode }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(version.cid, Boolean(version.cid));
  const snapshotDoc = useMemo(() => (isIpfsDocumentResponse(data) ? data : null), [data]);

  return (
    <li className="card-tight">
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
      ) : snapshotDoc?.html?.body ? (
        <article
          className="prose prose-xs mt-2 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: snapshotDoc.html.body }}
        />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No content available.</p>
      )}
    </li>
  );
}

function CommentContent({ cid }: { cid?: string }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(cid, Boolean(cid));
  const commentDoc = useMemo(() => (isIpfsDocumentResponse(data) ? data : null), [data]);

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
  if (!commentDoc?.html?.body) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment content.</p>;
  }
  return (
    <article
      className="prose prose-xs mt-2 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: commentDoc.html.body }}
    />
  );
}

function formatDraftTxError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("not authorized") || lower.includes("notauthorized")) {
    return "Only draft authors or contributors can escalate.";
  }
  if (lower.includes("invalidstatus") || lower.includes("finalized")) {
    return "Draft must be FINALIZED before escalation.";
  }
  if (lower.includes("review period")) {
    return "Review period not met yet.";
  }
  return message.replace(/execution reverted: ?/i, "");
}

function parseEscalatedProposalId(logs: Array<{ data?: Hex; topics?: Hex[] }>): string | null {
  for (const log of logs as Array<{ data?: Hex; topics?: Hex[]; proposalId?: bigint | string | number }>) {
    if (typeof log.proposalId === "bigint") {
      return log.proposalId.toString();
    }
    if (typeof log.proposalId === "number" && Number.isFinite(log.proposalId)) {
      return String(log.proposalId);
    }
    if (typeof log.proposalId === "string" && log.proposalId.length > 0) {
      return log.proposalId;
    }

    if (!log.data || !log.topics || log.topics.length === 0) continue;

    const topics = [log.topics[0], ...log.topics.slice(1)] as [Hex, ...Hex[]];

    try {
      const decoded = decodeEventLog({
        abi: COMMUNITY_MODULE_ABIS.draftsManager,
        data: log.data,
        topics,
        strict: false
      });

      if (decoded.eventName !== "ProposalEscalated") continue;

      const candidate = (decoded.args as { proposalId?: bigint }).proposalId;
      if (typeof candidate === "bigint") {
        return candidate.toString();
      }
    } catch {
      // Ignore non-matching logs and continue scanning.
    }
  }

  return null;
}

function usePublicClientCompat() {
  const publicClient = usePublicClient();
  if (!publicClient) {
    throw new Error("Public client unavailable");
  }
  return publicClient;
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
