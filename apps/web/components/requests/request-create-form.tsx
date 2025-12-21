"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";

import { getContractConfig } from "../../lib/contracts";

export function RequestCreateForm() {
  const router = useRouter();
  const chainId = useChainId();
  const { address, status } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [communityId, setCommunityId] = useState("1");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const communityIdNum = Number(communityId);
    if (!Number.isFinite(communityIdNum) || communityIdNum <= 0) {
      alert("Enter a valid community ID");
      return;
    }
    if (!title.trim() || !body.trim()) {
      alert("Title and content are required");
      return;
    }

    try {
      setIsUploading(true);
      const uploadRes = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            type: "request",
            version: "1",
            title,
            bodyMarkdown: body,
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            attachments: [],
            createdBy: address,
            createdAt: new Date().toISOString()
          }
        })
      });

      const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.cid) {
        throw new Error(uploadJson.error ?? "Failed to upload content to IPFS");
      }

      const { address: contractAddress, abi } = getContractConfig("requestHub", chainId);

      await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "createRequest",
        args: [
          BigInt(communityIdNum),
          title.trim(),
          uploadJson.cid,
          tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        ]
      });

      setSuccessMessage("Request submitted on-chain. It will appear after the indexer updates.");
      setTitle("");
      setBody("");
      setTags("");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Create Request</h2>
          <p className="text-sm text-muted-foreground">
            Publish a request by pinning markdown to IPFS and submitting on-chain to RequestHub.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Network: {chainId ?? "unknown"}
        </span>
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
        <label className="flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="text-muted-foreground">Tags (comma separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="governance, treasury"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Summarize the request"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Content (markdown)</span>
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[160px] rounded border border-border bg-background px-3 py-2"
            placeholder="Detail the problem, context, and desired outcomes"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending || isUploading ? "Submitting..." : "Submit request"}
        </button>
        {!isConnected ? (
          <span className="text-xs text-destructive">Connect a wallet to submit.</span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span>
        ) : null}
        {successMessage ? (
          <span className="text-xs text-emerald-600">{successMessage}</span>
        ) : null}
      </div>
    </form>
  );
}
