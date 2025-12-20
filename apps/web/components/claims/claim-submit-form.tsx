"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";

import { getContractConfig } from "../../lib/contracts";

export function ClaimSubmitForm() {
  const router = useRouter();
  const chainId = useChainId();
  const { address, status } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [typeId, setTypeId] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const typeIdNum = Number(typeId);
    if (!Number.isFinite(typeIdNum) || typeIdNum <= 0) {
      alert("Enter a valid valuable action ID");
      return;
    }
    if (!title.trim() || !description.trim()) {
      alert("Title and description are required");
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

      const { address: contractAddress, abi } = getContractConfig("claims", chainId);

      await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "submit",
        args: [BigInt(typeIdNum), uploadJson.cid]
      });

      setSuccessMessage("Claim submitted. It will appear after the indexer updates.");
      setTitle("");
      setDescription("");
      setEvidenceLinks("");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Submit Claim</h2>
        <p className="text-sm text-muted-foreground">
          Upload an evidence manifest to IPFS and submit to the Claims contract for juror verification.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending || isUploading ? "Submitting..." : "Submit claim"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to submit.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {successMessage ? <span className="text-xs text-emerald-600">{successMessage}</span> : null}
      </div>
    </form>
  );
}
