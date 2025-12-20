"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { useRouter } from "next/navigation";

import { useApiQuery } from "../../hooks/useApiQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { getContractConfig } from "../../lib/contracts";
import type { DraftNode } from "./draft-list";

type DraftVersionNode = {
  id: string;
  cid: string;
  contributor: string;
  createdAt: string;
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
    versions: DraftVersionNode[];
    reviews: DraftReviewNode[];
  }) | null;
};

export type DraftDetailProps = {
  draftId: string;
};

export function DraftDetail({ draftId }: DraftDetailProps) {
  const { data, isLoading, isError, refetch } = useApiQuery<DraftDetailResponse>(
    ["draft", draftId],
    `/drafts/${draftId}`
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
        <DraftEscalateForm
          draftId={draftId}
          status={draft.status}
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

function DraftEscalateForm({
  draftId,
  status,
  hasProposal
}: {
  draftId: string;
  status: string;
  hasProposal: boolean;
}) {
  const router = useRouter();
  const chainId = useChainId();
  const { status: accountStatus, address } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [descriptionCid, setDescriptionCid] = useState("");
  const [descriptionMarkdown, setDescriptionMarkdown] = useState("");
  const [isMultiChoice, setIsMultiChoice] = useState(false);
  const [numOptions, setNumOptions] = useState(2);
  const [isUploading, setIsUploading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isConnected = accountStatus === "connected";
  const disabled = !isConnected || isPending || isUploading || hasProposal;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);

    if (!descriptionCid && !descriptionMarkdown.trim()) {
      setFormError("Provide a description markdown body or an existing CID.");
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

      const { address: contractAddress, abi } = getContractConfig("draftsManager", chainId);

      await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "escalateToProposal",
        args: [BigInt(draftId), isMultiChoice, Number(numOptions), cidToUse]
      });

      setFormMessage("Escalation sent. Proposal will appear after the indexer updates.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError(formatDraftTxError(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 shadow-sm">
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
          disabled={disabled}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending || isUploading ? "Submitting..." : "Escalate"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to escalate.</span> : null}
        {hasProposal ? <span className="text-xs text-muted-foreground">Proposal already escalated.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {formMessage ? <span className="text-xs text-emerald-600">{formMessage}</span> : null}
        {formError ? <span className="text-xs text-destructive">{formError}</span> : null}
      </div>
    </form>
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
