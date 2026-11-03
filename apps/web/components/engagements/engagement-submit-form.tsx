"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { extractSubmittedEngagementId } from "../../lib/engagements/submit-receipt";
import { EngagementSubmissionTracker } from "./engagement-submission-tracker";

type SubmitFormProps = {
  /** Overrides for the post-submit indexer polling (tests). */
  indexerPollIntervalMs?: number;
  indexerTimeoutMs?: number;
};

export function EngagementSubmitForm({ indexerPollIntervalMs, indexerTimeoutMs }: SubmitFormProps = {}) {
  const router = useRouter();
  const chainId = useChainId();
  const { address, status } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [typeId, setTypeId] = useState("1");
  const [communityId, setCommunityId] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<{
    txHash: string;
    communityId: number;
    engagementId: number | null;
  } | null>(null);
  const publicClient = usePublicClient();

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;

  const communityIdNum = Number(communityId);
  const { modules } = useCommunityModules({
    communityId: Number.isFinite(communityIdNum) ? communityIdNum : undefined,
    chainId,
    enabled: true
  });
  const engagementsAddress = modules?.engagementsManager;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmission(null);

    const typeIdNum = Number(typeId);
    if (!Number.isFinite(communityIdNum) || communityIdNum <= 0) {
      setFormError("Enter a valid community ID");
      return;
    }
    if (!Number.isFinite(typeIdNum) || typeIdNum <= 0) {
      setFormError("Enter a valid valuable action ID");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setFormError("Title and description are required");
      return;
    }

    const evidence = evidenceLinks
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((link, idx) => ({
        cid: link.startsWith("ipfs://") ? link.replace("ipfs://", "") : link,
        title: `Evidence ${idx + 1}`
      }));

    try {
      setIsUploading(true);
      const uploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            type: "claimEvidence",
            evidence,
            summary: description,
            title,
            submittedBy: address,
            submittedAt: new Date().toISOString()
          }
        })
      });

      const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.cid) {
        throw new Error(uploadJson.error ?? "Failed to upload evidence to IPFS");
      }

      if (!engagementsAddress) {
        throw new Error("Engagements module is not registered for this community.");
      }

      const contractAddress = engagementsAddress;
      const abi = COMMUNITY_MODULE_ABIS.engagements;

      const txHash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "submit",
        args: [BigInt(typeIdNum), uploadJson.cid]
      });

      // Only claim "confirmed" once the chain has the receipt; the id comes from the emitted event.
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash });
      if (receipt && receipt.status !== "success") {
        throw new Error("The submit transaction reverted on-chain.");
      }
      setSubmission({
        txHash,
        communityId: communityIdNum,
        engagementId: receipt ? extractSubmittedEngagementId(receipt.logs, abi, contractAddress) : null
      });
      setTitle("");
      setDescription("");
      setEvidenceLinks("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Failed to submit engagement");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Submit Engagement</h2>
        <p className="text-sm text-muted-foreground">
          Upload an evidence manifest to IPFS and submit to the Engagements contract for juror verification.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Community ID</span>
          <input
            required
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Valuable Action ID</span>
          <input
            required
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Evidence CIDs (comma separated)</span>
          <input
            value={evidenceLinks}
            onChange={(e) => setEvidenceLinks(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Optional ipfs://... entries"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Work completed"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Description</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[140px] rounded border border-border bg-background px-3 py-2"
            placeholder="Summarize the delivered work and link evidence"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="btn-primary"
        >
          {isPending || isUploading ? "Submitting..." : "Submit engagement"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to submit.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {formError ? (
          <span role="alert" className="text-xs text-destructive">
            {formError}
          </span>
        ) : null}
      </div>
      {submission ? (
        <EngagementSubmissionTracker
          {...submission}
          pollIntervalMs={indexerPollIntervalMs}
          timeoutMs={indexerTimeoutMs}
        />
      ) : null}
    </form>
  );
}
