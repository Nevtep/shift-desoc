"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";

import { getContractConfig } from "../../lib/contracts";

export function DraftCreateForm() {
  const router = useRouter();
  const chainId = useChainId();
  const { status, address } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [communityId, setCommunityId] = useState("1");
  const [requestId, setRequestId] = useState("0");
  const [versionCid, setVersionCid] = useState("");
  const [content, setContent] = useState("");
  const [targets, setTargets] = useState("");
  const [values, setValues] = useState("");
  const [calldatas, setCalldatas] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;

  function parseAddresses(input: string): string[] {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseValues(input: string): bigint[] {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((val) => BigInt(val));
  }

  function parseBytes(input: string): `0x${string}`[] {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((hex) => (hex.startsWith("0x") ? (hex as `0x${string}`) : (`0x${hex}` as `0x${string}`)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

    const communityIdNum = Number(communityId);
    const requestIdNum = Number(requestId);
    if (!Number.isFinite(communityIdNum) || communityIdNum <= 0) {
      alert("Enter a valid community ID");
      return;
    }
    if (!Number.isFinite(requestIdNum) || requestIdNum < 0) {
      alert("Enter a valid request ID (0 for none)");
      return;
    }
    if (!versionCid && !content.trim()) {
      alert("Provide content to pin or an existing CID");
      return;
    }

    let cidToUse = versionCid;
    try {
      if (!versionCid) {
        setIsUploading(true);
        const uploadRes = await fetch("/api/ipfs/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: {
              type: "draftVersion",
              body: content,
              createdBy: address,
              createdAt: new Date().toISOString()
            }
          })
        });
        const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
        if (!uploadRes.ok || !uploadJson.cid) {
          throw new Error(uploadJson.error ?? "Failed to upload draft content");
        }
        cidToUse = uploadJson.cid;
      }

      const parsedTargets = parseAddresses(targets);
      const parsedValues = parseValues(values);
      const parsedCalldatas = parseBytes(calldatas);

      const { address: contractAddress, abi } = getContractConfig("draftsManager", chainId);

      await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "createDraft",
        args: [
          BigInt(communityIdNum),
          BigInt(requestIdNum),
          {
            targets: parsedTargets,
            values: parsedValues,
            calldatas: parsedCalldatas,
            actionsHash: "0x0000000000000000000000000000000000000000000000000000000000000000"
          },
          cidToUse
        ]
      });

      setSuccess("Draft created. It will surface after the indexer updates.");
      setContent("");
      setVersionCid("");
      setTargets("");
      setValues("");
      setCalldatas("");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Create Draft</h2>
          <p className="text-sm text-muted-foreground">Pin a draft version to IPFS and register on DraftsManager.</p>
        </div>
        <span className="text-xs text-muted-foreground">Network: {chainId ?? "unknown"}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Community ID</span>
          <input
            required
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Request ID (0 for none)</span>
          <input
            required
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Existing version CID (optional)</span>
          <input
            value={versionCid}
            onChange={(e) => setVersionCid(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="Use existing CID or leave blank to upload"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Draft content (markdown)</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[140px] rounded border border-border bg-background px-3 py-2"
            placeholder="Supply markdown content if you do not provide a CID"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Targets (comma separated, optional)</span>
          <input
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="0xabc...,0xdef..."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Values in wei (comma separated, optional)</span>
          <input
            value={values}
            onChange={(e) => setValues(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="0,0"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Calldatas hex (comma separated, optional)</span>
          <input
            value={calldatas}
            onChange={(e) => setCalldatas(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
            placeholder="0x...,0x..."
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending || isUploading ? "Submitting..." : "Create draft"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to submit.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {success ? <span className="text-xs text-emerald-600">{success}</span> : null}
      </div>
    </form>
  );
}
