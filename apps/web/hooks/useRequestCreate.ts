"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "./useCommunityModules";

export type UseRequestCreateOptions = {
  fixedCommunityId?: number;
  successRedirectHref?: string;
  initialCommunityId?: string;
  toastPush?: (message: string, variant?: "default" | "error" | "success") => void;
};

export function useRequestCreate({
  fixedCommunityId,
  successRedirectHref,
  initialCommunityId,
  toastPush
}: UseRequestCreateOptions = {}) {
  const router = useRouter();
  const chainId = useChainId();
  const { address, status } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const fromFixed =
    Number.isFinite(fixedCommunityId) && (fixedCommunityId ?? 0) > 0 ? String(fixedCommunityId) : "";

  const fromInitial =
    initialCommunityId && /^\d+$/.test(initialCommunityId.trim()) && Number(initialCommunityId) > 0
      ? initialCommunityId.trim()
      : "";

  const [communityId, setCommunityId] = useState(fromFixed || fromInitial || "1");
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

  useEffect(() => {
    if (isFixedCommunity) return;
    if (fromInitial) setCommunityId(fromInitial);
  }, [fromInitial, isFixedCommunity]);

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

  function resetTransientFields(): void {
    setTitle("");
    setBody("");
    setTags("");
    setSelectedValuableActionId("");
    setRequestType("governance");
    setSuccessMessage(null);
  }

  async function handleSubmit(onSuccess?: () => void): Promise<void> {
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
            tags: tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
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
      resetTransientFields();
      toastPush?.("Request created. May take a moment to appear if the indexer is lagging.", "success");
      if (successRedirectHref) {
        router.push(successRedirectHref as never);
      } else {
        router.refresh();
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setIsUploading(false);
    }
  }

  return {
    chainId,
    address,
    isConnected,
    disabled,
    isFixedCommunity,
    communityId,
    setCommunityId,
    title,
    setTitle,
    body,
    setBody,
    tags,
    setTags,
    requestType,
    setRequestType,
    selectedValuableActionId,
    setSelectedValuableActionId,
    isUploading,
    isPending,
    error,
    requestHubAddress,
    isFetchingModules,
    isFetchingVas,
    activeVaIds,
    valuableActionRegistryAddress,
    communityIdNum,
    successMessage,
    handleSubmit
  };
}
