"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Address } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import {
  ActionsTable,
  ExpertActionBuilder,
  GuidedActionBuilder,
  type PreparedAction
} from "../drafts/draft-create-form";
import { useCommunityModules, COMMUNITY_MODULE_ABIS } from "../../hooks/useCommunityModules";
import { getAllowlistedSignatureSet } from "../../lib/actions/allowlist";
import {
  buildTargetAvailability,
  type CommunityModuleAddressMap,
  resolveTargetAddress
} from "../../lib/actions/target-resolution";
import { listActionTargetIds, type ActionTargetId } from "../../lib/actions/registry";
import { validateComposerAllowlist } from "../../lib/governance/direct-proposal-guards";
import { classifySubmitError, submitDirectProposal } from "../../lib/governance/direct-proposal-submit";
import { DirectProposalCreateComponent } from "./direct-proposal-create.component";

function toModuleAddressMap(modules: ReturnType<typeof useCommunityModules>["modules"]): CommunityModuleAddressMap {
  return {
    membershipToken: modules?.membershipToken,
    draftsManager: modules?.draftsManager,
    engagements: modules?.engagementsManager,
    valuableActionRegistry: modules?.valuableActionRegistry,
    verifierPowerToken: modules?.verifierPowerToken,
    verifierElection: modules?.verifierElection,
    verifierManager: modules?.verifierManager,
    valuableActionSBT: modules?.valuableActionSBT,
    positionManager: modules?.positionManager,
    credentialManager: modules?.credentialManager,
    cohortRegistry: modules?.cohortRegistry,
    investmentCohortManager: modules?.investmentCohortManager,
    revenueRouter: modules?.revenueRouter,
    treasuryAdapter: modules?.treasuryAdapter,
    paramController: modules?.paramController,
    commerceDisputes: modules?.commerceDisputes,
    marketplace: modules?.marketplace,
    housingManager: modules?.housingManager
  };
}

export function DirectProposalCreateContainer({ communityId }: { communityId: number }) {
  const router = useRouter();
  const chainId = useChainId();
  const { status: accountStatus } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: communityId > 0 });

  const [composerMode, setComposerMode] = useState<"guided" | "expert">("guided");
  const [proposalMode, setProposalMode] = useState<"binary" | "multi_choice">("binary");
  const [numOptions, setNumOptions] = useState(2);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);
  const [actions, setActions] = useState<PreparedAction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitLock = useRef({ current: false });

  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
  const targetIds = useMemo(() => listActionTargetIds(), []);
  const moduleAddressMap = useMemo(() => toModuleAddressMap(modules), [modules]);

  const targetAvailability = useMemo(() => {
    return buildTargetAvailability(targetIds, chainId, moduleAddressMap, (targetId) =>
      [...getAllowlistedSignatureSet(targetId)]
    );
  }, [targetIds, chainId, moduleAddressMap]);

  const targetAvailabilityMap = useMemo(() => {
    return targetAvailability.reduce<Record<ActionTargetId, (typeof targetAvailability)[number]>>((acc, entry) => {
      acc[entry.targetId] = entry;
      return acc;
    }, {} as Record<ActionTargetId, (typeof targetAvailability)[number]>);
  }, [targetAvailability]);

  const allowlistedSignaturesByTarget = useMemo(() => {
    return targetIds.reduce<Record<string, Set<string>>>((acc, targetId) => {
      acc[targetId] = getAllowlistedSignatureSet(targetId);
      return acc;
    }, {});
  }, [targetIds]);

  function resolveActionTarget(targetId: ActionTargetId): Address | null {
    try {
      return resolveTargetAddress(targetId, chainId, moduleAddressMap);
    } catch {
      return null;
    }
  }

  function handleRemoveAction(index: number) {
    setActions((prev) => prev.filter((_, current) => current !== index));
  }

  function handleMoveAction(index: number, direction: -1 | 1) {
    setActions((prev) => {
      const next = index + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  async function uploadProposalMetadata() {
    const payload = {
      type: "governanceProposal",
      version: "1",
      title: title.trim(),
      summary: summary.trim(),
      bodyMarkdown: description.trim(),
      mode: proposalMode,
      numOptions: proposalMode === "multi_choice" ? numOptions : null,
      communityId,
      createdAt: new Date().toISOString(),
      actions: actions.map((action) => ({
        target: action.target,
        value: action.value.toString(),
        calldata: action.calldata,
        functionSignature: action.functionSignature,
        targetId: action.targetId,
        targetLabel: action.targetLabel,
        argsPreview: action.argsPreview
      }))
    };

    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload })
    });

    const json = (await response.json()) as { cid?: string; error?: string };
    if (!response.ok || !json.cid) {
      throw new Error(json.error ?? "Failed to upload proposal metadata to IPFS");
    }

    return json.cid;
  }

  async function handleSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (accountStatus !== "connected") {
      setErrorMessage("Connect your wallet before submitting a proposal.");
      return;
    }

    if (!modules?.governor) {
      setErrorMessage("Governor module is missing for this community.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Proposal title is required.");
      return;
    }

    if (!summary.trim()) {
      setErrorMessage("Proposal summary is required.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Proposal details are required.");
      return;
    }

    if (!actions.length) {
      setErrorMessage("At least one action is required.");
      return;
    }

    const rawIntent = {
      communityId,
      governorAddress: modules.governor,
      mode: proposalMode,
      targets: actions.map((action) => action.target),
      values: actions.map((action) => action.value),
      calldatas: actions.map((action) => action.calldata),
      description,
      numOptions: proposalMode === "multi_choice" ? numOptions : undefined,
      actions
    } as const;

    const allowlistGuard = validateComposerAllowlist({
      intent: rawIntent,
      chainId,
      moduleAddressMap,
      allowlistedSignaturesByTarget
    });

    if (!allowlistGuard.ok) {
      setErrorMessage(allowlistGuard.message);
      return;
    }

    if (!publicClient) {
      setErrorMessage("Public client unavailable for transaction confirmation.");
      return;
    }

    try {
      setIsSubmitting(true);
      setIsUploadingMetadata(true);
      setStatusMessage("Uploading proposal metadata to IPFS...");

      const proposalCid = await uploadProposalMetadata();
      const intent = {
        ...rawIntent,
        description: proposalCid
      };

      setIsUploadingMetadata(false);
      setStatusMessage("Preparing wallet confirmation...");

      const result = await submitDirectProposal({
        intent,
        routeCommunityId: communityId,
        resolvedGovernorAddress: modules.governor,
        connectedChainId: chainId,
        expectedChainId,
        governorAbi: COMMUNITY_MODULE_ABIS.governor,
        writeContractAsync,
        publicClient,
        submitLock: submitLock.current
      });

      setStatusMessage(result.routing.userMessage);
      setSuccessMessage(
        result.creation.proposalId !== null
          ? `Proposal created: ${result.creation.proposalId.toString()} (CID: ${proposalCid})`
          : `Transaction confirmed: ${result.creation.txHash} (CID: ${proposalCid})`
      );

      setTitle("");
      setSummary("");
      setDescription("");

      router.push(result.routing.href as never);
    } catch (error) {
      const mapped = classifySubmitError(error);
      setErrorMessage(mapped.message);
      setStatusMessage(null);
    } finally {
      setIsUploadingMetadata(false);
      setIsSubmitting(false);
    }
  }

  const composerSection =
    composerMode === "guided" ? (
      <GuidedActionBuilder
        targetAvailability={targetAvailabilityMap}
        allowlistedSignatureMap={allowlistedSignaturesByTarget as Record<ActionTargetId, Set<string>>}
        resolveTargetAddress={resolveActionTarget}
        onAddAction={(action) => setActions((prev) => [...prev, action])}
      />
    ) : (
      <ExpertActionBuilder
        targetAvailability={targetAvailabilityMap}
        allowlistedSignatureMap={allowlistedSignaturesByTarget as Record<ActionTargetId, Set<string>>}
        resolveTargetAddress={resolveActionTarget}
        onAddAction={(action) => setActions((prev) => [...prev, action])}
      />
    );

  return (
    <DirectProposalCreateComponent
      communityId={communityId}
      composerMode={composerMode}
      proposalMode={proposalMode}
      numOptions={numOptions}
      title={title}
      summary={summary}
      description={description}
      actions={actions}
      isSubmitting={isSubmitting || isUploadingMetadata}
      errorMessage={errorMessage}
      successMessage={successMessage}
      statusMessage={statusMessage}
      onComposerModeChange={setComposerMode}
      onProposalModeChange={setProposalMode}
      onNumOptionsChange={setNumOptions}
      onTitleChange={setTitle}
      onSummaryChange={setSummary}
      onDescriptionChange={setDescription}
      onSubmit={() => void handleSubmit()}
      onRemoveAction={handleRemoveAction}
      onMoveAction={handleMoveAction}
      composerSection={composerSection}
      actionsSection={<ActionsTable actions={actions} onRemove={handleRemoveAction} onMove={handleMoveAction} />}
    />
  );
}
