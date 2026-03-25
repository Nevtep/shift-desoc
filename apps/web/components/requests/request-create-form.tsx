"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { useToast } from "../ui/toaster";

export function RequestCreateForm({
  fixedCommunityId,
  successRedirectHref
}: {
  fixedCommunityId?: number;
  successRedirectHref?: string;
} = {}) {
  const router = useRouter();
  const { push } = useToast();
  const chainId = useChainId();
  const { address, status } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [communityId, setCommunityId] = useState(
    Number.isFinite(fixedCommunityId) && (fixedCommunityId ?? 0) > 0 ? String(fixedCommunityId) : "1"
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [requestType, setRequestType] = useState<"governance" | "execution">("governance");
  const [selectedValuableActionId, setSelectedValuableActionId] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;
  const isFixedCommunity = Number.isFinite(fixedCommunityId) && (fixedCommunityId ?? 0) > 0;

  const communityIdNum = Number(communityId);
  const { modules, isFetching: isFetchingModules } = useCommunityModules({
    communityId: Number.isFinite(communityIdNum) ? communityIdNum : undefined,
    chainId,
    enabled: true
  });

  const requestHubAddress = modules?.requestHub;
  const valuableActionRegistryAddress = modules?.valuableActionRegistry;

  const { data: activeVaIdsRaw, isFetching: isFetchingVas } = useReadContract({
    address: valuableActionRegistryAddress,
    abi: COMMUNITY_MODULE_ABIS.valuableActionRegistry,
    functionName: "getActiveValuableActions",
    query: {
      enabled:
        requestType === "execution" &&
        Boolean(valuableActionRegistryAddress) &&
        Number.isFinite(communityIdNum) &&
        communityIdNum > 0
    }
  });

  const activeVaIds = useMemo(() => {
    if (!Array.isArray(activeVaIdsRaw)) return [] as string[];
    return (activeVaIdsRaw as bigint[]).map((id) => id.toString());
  }, [activeVaIdsRaw]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    if (!Number.isFinite(communityIdNum) || communityIdNum <= 0) {
      alert("Enter a valid community ID");
      return;
    }
    if (!title.trim() || !body.trim()) {
      alert("Title and content are required");
      return;
    }

    if (requestType === "execution" && !selectedValuableActionId.trim()) {
      alert("Select a Valuable Action to link");
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
            createdAt: new Date().toISOString(),
            requestType,
            linkedValuableActionId: requestType === "execution" ? selectedValuableActionId || null : null
          }
        })
      });

      const uploadJson = (await uploadRes.json()) as { cid?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.cid) {
        throw new Error(uploadJson.error ?? "Failed to upload content to IPFS");
      }

      if (!requestHubAddress) {
        throw new Error("RequestHub module is not registered for this community.");
      }

      const contractAddress = requestHubAddress;
      const abi = COMMUNITY_MODULE_ABIS.requestHub;

      let anticipatedRequestId: bigint | null = null;
      if (requestType === "execution" && publicClient) {
        try {
          const nextId = await publicClient.readContract({
            address: contractAddress,
            abi,
            functionName: "nextRequestId"
          });
          anticipatedRequestId = typeof nextId === "bigint" ? nextId : BigInt(nextId as number);
        } catch (readErr) {
          console.error(readErr);
        }
      }

      const createTxHash = await writeContractAsync({
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

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: createTxHash });
      }

      if (requestType === "execution" && selectedValuableActionId && anticipatedRequestId && publicClient) {
        try {
          const vaId = BigInt(selectedValuableActionId);
          const linkTxHash = await writeContractAsync({
            address: contractAddress,
            abi,
            functionName: "linkValuableAction",
            args: [anticipatedRequestId, vaId]
          });
          await publicClient.waitForTransactionReceipt({ hash: linkTxHash });
        } catch (linkErr) {
          console.error(linkErr);
          alert(linkErr instanceof Error ? linkErr.message : "Failed to link Valuable Action");
        }
      }

      setSuccessMessage(
        requestType === "execution"
          ? "Request submitted and Valuable Action linked. It will appear after the indexer updates."
          : "Request submitted on-chain. It will appear after the indexer updates."
      );
      setTitle("");
      setBody("");
      setTags("");
      setSelectedValuableActionId("");
      setRequestType("governance");
      push("Request created. May take a moment to appear if the indexer is lagging.", "success");
      if (successRedirectHref) {
        router.push(successRedirectHref);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
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
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Request type</span>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="request-type"
                value="governance"
                checked={requestType === "governance"}
                onChange={() => setRequestType("governance")}
              />
              <span>Governance (will escalate to draft/proposal)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="request-type"
                value="execution"
                checked={requestType === "execution"}
                onChange={() => setRequestType("execution")}
              />
              <span>Execution (link a Valuable Action)</span>
            </label>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Community ID</span>
          {isFixedCommunity ? (
            <div className="rounded border border-border bg-muted px-3 py-2 text-sm text-foreground">
              Community #{communityId}
            </div>
          ) : (
            <input
              required
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="rounded border border-border bg-background px-3 py-2"
              placeholder="1"
            />
          )}
        </label>
        {requestType === "execution" ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Linked Valuable Action</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedValuableActionId}
                onChange={(e) => setSelectedValuableActionId(e.target.value)}
                className="rounded border border-border bg-background px-3 py-2 sm:w-1/2"
                disabled={isFetchingModules || isFetchingVas || activeVaIds.length === 0}
              >
                <option value="">{isFetchingVas ? "Loading active actions..." : "Select active action"}</option>
                {activeVaIds.map((id) => (
                  <option key={id} value={id}>
                    Valuable Action {id}
                  </option>
                ))}
              </select>
              <input
                value={selectedValuableActionId}
                onChange={(e) => setSelectedValuableActionId(e.target.value)}
                className="rounded border border-border bg-background px-3 py-2 sm:w-1/2"
                placeholder="Or enter an action ID manually"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Active Valuable Actions are loaded from chain; you can also paste a specific ID.
            </span>
          </label>
        ) : null}
        {Number.isFinite(communityIdNum) && communityIdNum > 0 && !requestHubAddress ? (
          <p className="text-xs text-destructive sm:col-span-2">
            RequestHub module not found for community {communityIdNum}. Check CommunityRegistry wiring.
          </p>
        ) : null}
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
          className="btn-primary"
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
