"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  keccak256,
  encodePacked,
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex,
  type AbiParameter,
} from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";

import { CONTRACTS, getContractConfig } from "../../lib/contracts";
import { COMMUNITY_MODULE_ABIS } from "../../hooks/useCommunityModules";
import { useToast } from "../ui/toaster";
import {
  GUIDED_EVIDENCE_PRESETS,
  GUIDED_REWARD_TIERS,
  GUIDED_VALUE_ACTION_LOCKED_DEFAULTS,
  GUIDED_VERIFICATION_STRICTNESS,
  getTargetDefinition,
  getTargetFunctions,
  listActionTargets,
  listGuidedTemplates,
  type ActionTargetId
} from "../../lib/actions/registry";

type PreparedAction = {
  target: Address;
  value: bigint;
  calldata: Hex;
  targetLabel: string;
  functionName: string;
  argsPreview: string[];
};

type ActionFormState = {
  targetId?: ActionTargetId;
  functionName?: string;
  value: string;
  paramValues: Record<string, string>;
  tupleArrayCounts: Record<string, number>;
};

type ActionComposerMode = "guided" | "expert";

type GuidedFormState = {
  templateId: "valuableActionProposal" | "requestStatus";
  title: string;
  rewardTierId: "micro" | "standard" | "high";
  strictnessId: "light" | "balanced" | "strict";
  evidenceId: "basic" | "traceable" | "auditable";
  revocable: boolean;
  proposalRefSeed: string;
  requestId: string;
  requestStatus: "1" | "2";
};

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function getCreateDraftInputCount(abi: Abi): number {
  const fn = abi.find((item) => item.type === "function" && item.name === "createDraft") as AbiFunction | undefined;
  if (!fn) {
    throw new Error("DraftsManager ABI missing createDraft");
  }
  return fn.inputs.length;
}

export function DraftCreateForm({
  fixedCommunityId,
  initialRequestId,
  successRedirectHref,
  mode = "guided",
  expertHref,
  guidedHref
}: {
  fixedCommunityId?: number;
  initialRequestId?: number;
  successRedirectHref?: string;
  mode?: ActionComposerMode;
  expertHref?: string;
  guidedHref?: string;
} = {}) {
  const router = useRouter();
  const { push } = useToast();
  const chainId = useChainId();
  const { status, address } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const [communityId, setCommunityId] = useState(
    Number.isFinite(fixedCommunityId) && (fixedCommunityId ?? 0) > 0 ? String(fixedCommunityId) : "1"
  );
  const [requestId, setRequestId] = useState(
    Number.isFinite(initialRequestId) && (initialRequestId ?? -1) >= 0 ? String(initialRequestId) : "0"
  );
  const [versionCid, setVersionCid] = useState("");
  const [content, setContent] = useState("");
  const [actions, setActions] = useState<PreparedAction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const communityIdNum = Number(communityId);
  const requestIdNum = Number(requestId);

  const isConnected = status === "connected";
  const disabled = !isConnected || isPending || isUploading;
  const isFixedCommunity = Number.isFinite(fixedCommunityId) && (fixedCommunityId ?? 0) > 0;
  const isExpertMode = mode === "expert";

  const communityRegistry = useMemo(() => {
    try {
      return getContractConfig("communityRegistry", chainId);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [chainId]);

  const { data: moduleAddresses } = useReadContract({
    address: communityRegistry?.address,
    abi: communityRegistry?.abi,
    functionName: "getCommunityModules",
    args: [BigInt(Number.isFinite(communityIdNum) && communityIdNum > 0 ? communityIdNum : 0)],
    query: { enabled: Boolean(communityRegistry) && Number.isFinite(communityIdNum) && communityIdNum > 0 }
  });

  const moduleAddressMap = useMemo(() => {
    if (!moduleAddresses) return {} as Record<string, Address>;

    // CommunityRegistry.getCommunityModules returns ModuleAddresses struct; wagmi returns as array with named keys
    const modules = moduleAddresses as unknown as Record<string, Address> & Address[];
    return {
      governor: modules.governor ?? modules[0],
      timelock: modules.timelock ?? modules[1],
      requestHub: modules.requestHub ?? modules[2],
      draftsManager: modules.draftsManager ?? modules[3],
      engagementsManager: modules.engagementsManager ?? modules[4],
      valuableActionRegistry: modules.valuableActionRegistry ?? modules[5],
      verifierPowerToken: modules.verifierPowerToken ?? modules[6],
      verifierElection: modules.verifierElection ?? modules[7],
      verifierManager: modules.verifierManager ?? modules[8],
      valuableActionSBT: modules.valuableActionSBT ?? modules[9],
      treasuryAdapter: modules.treasuryAdapter ?? modules[10],
      communityToken: modules.communityToken ?? modules[11],
      paramController: modules.paramController ?? modules[12]
    };
  }, [moduleAddresses]);

  const timelockAddress = moduleAddressMap.timelock ?? null;

  function resolveTargetAddress(targetId: ActionTargetId): Address | null {
    // Resolve module targets from per-community registry wiring.
    if (targetId === "draftsManager" && moduleAddressMap.draftsManager) return moduleAddressMap.draftsManager;
    if (targetId === "engagements" && moduleAddressMap.engagementsManager) return moduleAddressMap.engagementsManager;
    if (targetId === "valuableActionRegistry" && moduleAddressMap.valuableActionRegistry)
      return moduleAddressMap.valuableActionRegistry;
    if (targetId === "communityRegistry") return getContractConfig("communityRegistry", chainId).address;
    if (targetId === "requestHub" && moduleAddressMap.requestHub) return moduleAddressMap.requestHub;
    if (targetId === "governor" && moduleAddressMap.governor) return moduleAddressMap.governor;

    return null;
  }

  function handleRemoveAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);

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
              version: "1",
              type: "draftVersion",
              draftId: "pending",
              author: address ?? "unknown",
              bodyMarkdown: content,
              changelog: [],
              actionBundlePreview: {
                targets: actions.map((action) => action.target),
                values: actions.map((action) => action.value.toString()),
                signatures: actions.map((action) => action.functionName)
              },
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

      const targets = actions.map((action) => action.target);
      const values = actions.map((action) => action.value);
      const calldatas = actions.map((action) => action.calldata);
      const actionsHash = actions.length
        ? keccak256(encodePacked(["address[]", "uint256[]", "bytes[]"], [targets, values, calldatas]))
        : ZERO_HASH;

      const contractAddress = moduleAddressMap.draftsManager;
      if (!contractAddress) {
        throw new Error("DraftsManager module is not registered for this community.");
      }

      const actionBundle = {
        targets,
        values,
        calldatas,
        actionsHash
      };

      const createDraftInputCount = getCreateDraftInputCount(COMMUNITY_MODULE_ABIS.draftsManager as Abi);
      const draftArgs =
        createDraftInputCount === 3
          ? [BigInt(requestIdNum), actionBundle, cidToUse]
          : createDraftInputCount === 4
            ? [BigInt(communityIdNum), BigInt(requestIdNum), actionBundle, cidToUse]
            : null;

      if (!draftArgs || draftArgs.length !== createDraftInputCount) {
        throw new Error(
          `DraftsManager createDraft ABI mismatch: expected ${createDraftInputCount} args but built ${draftArgs?.length ?? 0}`
        );
      }

      await writeContractAsync({
        address: contractAddress,
        abi: COMMUNITY_MODULE_ABIS.draftsManager,
        functionName: "createDraft",
        args: draftArgs
      });

      setSuccess("Draft created. It will surface after the indexer updates.");
      push("Draft created. May take a moment to appear if the indexer is lagging.", "success");
      setContent("");
      setVersionCid("");
      setActions([]);
      if (successRedirectHref) {
        router.push(successRedirectHref);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Create Draft</h2>
          <p className="text-sm text-muted-foreground">
            Pin a draft version to IPFS and register on DraftsManager.
          </p>
          <p className="text-xs text-muted-foreground">
            Composer mode: {isExpertMode ? "Expert (raw ABI)" : "Guided (safe presets)"}
            {isExpertMode ? (
              guidedHref ? (
                <>
                  {" "}
                  <Link href={guidedHref} className="underline">Switch to guided</Link>
                </>
              ) : null
            ) : expertHref ? (
              <>
                {" "}
                <Link href={expertHref} className="underline">Open expert mode</Link>
              </>
            ) : null}
          </p>
          {timelockAddress ? (
            <p className="text-xs text-muted-foreground">Timelock for community {communityId}: {timelockAddress}</p>
          ) : (
            <p className="text-xs text-amber-600">Timelock not found for this community. Actions may fail to encode.</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Network: {chainId ?? "unknown"}</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
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
              />
            )}
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
        </div>

        {isExpertMode ? (
          <ExpertActionBuilder
            chainId={chainId}
            resolveTargetAddress={resolveTargetAddress}
            onAddAction={(action) => setActions((prev) => [...prev, action])}
          />
        ) : (
          <GuidedActionBuilder
            communityId={communityIdNum}
            signerAddress={address}
            resolveTargetAddress={resolveTargetAddress}
            onAddAction={(action) => setActions((prev) => [...prev, action])}
          />
        )}

        <ActionsTable actions={actions} onRemove={handleRemoveAction} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={disabled}
            className="btn-primary"
          >
            {isPending || isUploading ? "Submitting..." : "Create draft"}
          </button>
          {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to submit.</span> : null}
          {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
          {success ? <span className="text-xs text-emerald-600">{success}</span> : null}
        </div>
      </form>
    </div>
  );
}

function GuidedActionBuilder({
  communityId,
  signerAddress,
  resolveTargetAddress,
  onAddAction
}: {
  communityId: number;
  signerAddress?: Address;
  resolveTargetAddress: (targetId: ActionTargetId) => Address | null;
  onAddAction: (action: PreparedAction) => void;
}) {
  const [form, setForm] = useState<GuidedFormState>({
    templateId: "valuableActionProposal",
    title: "",
    rewardTierId: "standard",
    strictnessId: "balanced",
    evidenceId: "traceable",
    revocable: true,
    proposalRefSeed: "",
    requestId: "",
    requestStatus: "1"
  });

  const templates = useMemo(() => listGuidedTemplates(), []);
  const currentTemplate = templates.find((template) => template.id === form.templateId);

  function handleAddGuidedAction() {
    const template = currentTemplate;
    if (!template) {
      alert("Select a template");
      return;
    }

    const target = resolveTargetAddress(template.targetId);
    if (!target) {
      alert("Selected target is not configured for this community");
      return;
    }

    const functionDefinition = getTargetFunctions(template.targetId).find(
      (fn) => fn.functionName === template.functionName
    );
    if (!functionDefinition) {
      alert("Target ABI function not found for template");
      return;
    }

    try {
      if (template.id === "valuableActionProposal") {
        if (!form.title.trim()) {
          alert("Title is required for Valuable Action proposals");
          return;
        }

        const rewardTier = GUIDED_REWARD_TIERS.find((tier) => tier.id === form.rewardTierId) ?? GUIDED_REWARD_TIERS[1];
        const strictness =
          GUIDED_VERIFICATION_STRICTNESS.find((preset) => preset.id === form.strictnessId) ??
          GUIDED_VERIFICATION_STRICTNESS[1];
        const evidencePreset =
          GUIDED_EVIDENCE_PRESETS.find((preset) => preset.id === form.evidenceId) ?? GUIDED_EVIDENCE_PRESETS[1];

        const proposalSeed =
          form.proposalRefSeed.trim() ||
          `${communityId || 0}:${signerAddress || ZERO_ADDRESS}:${form.title}:${Date.now()}`;
        const proposalRef = keccak256(encodePacked(["string"], [proposalSeed]));

        const params = {
          membershipTokenReward: rewardTier.membershipTokenReward,
          communityTokenReward: rewardTier.communityTokenReward,
          investorSBTReward: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.investorSBTReward,
          category: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.category,
          roleTypeId: keccak256(encodePacked(["string"], [GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.roleTypeSeed])),
          positionPoints: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.positionPoints,
          verifierPolicy: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.verifierPolicy,
          metadataSchemaId: keccak256(
            encodePacked(["string"], [GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.metadataSchemaSeed])
          ),
          jurorsMin: strictness.jurorsMin,
          panelSize: strictness.panelSize,
          verifyWindow: strictness.verifyWindowSeconds,
          verifierRewardWeight: strictness.verifierRewardWeight,
          slashVerifierBps: strictness.slashVerifierBps,
          cooldownPeriod: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.cooldownPeriodSeconds,
          maxConcurrent: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.maxConcurrent,
          revocable: form.revocable,
          evidenceTypes: evidencePreset.evidenceTypes,
          proposalThreshold: BigInt(GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.proposalThreshold),
          proposer: signerAddress ?? ZERO_ADDRESS,
          evidenceSpecCID: evidencePreset.evidenceSpecCID,
          titleTemplate: form.title.trim(),
          automationRules: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.automationRuleSeeds.map((seed) =>
            keccak256(encodePacked(["string"], [seed]))
          ),
          activationDelay: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.activationDelaySeconds,
          deprecationWarning: GUIDED_VALUE_ACTION_LOCKED_DEFAULTS.deprecationWarningSeconds
        };

        const calldata = encodeFunctionData({
          abi: [functionDefinition.abiFragment],
          functionName: template.functionName,
          args: [params, proposalRef]
        });

        onAddAction({
          target,
          value: 0n,
          calldata,
          targetLabel: getTargetDefinition(template.targetId).label,
          functionName: template.functionName,
          argsPreview: [
            `title: ${form.title.trim()}`,
            `reward: ${rewardTier.label}`,
            `verification: ${strictness.label}`,
            `evidence: ${evidencePreset.label}`,
            `revocable: ${form.revocable ? "yes" : "no"}`
          ]
        });

        setForm((prev) => ({ ...prev, title: "", proposalRefSeed: "" }));
        return;
      }

      const requestId = Number(form.requestId);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        alert("Request ID must be a positive number");
        return;
      }

      const statusValue = Number(form.requestStatus);
      const calldata = encodeFunctionData({
        abi: [functionDefinition.abiFragment],
        functionName: template.functionName,
        args: [BigInt(requestId), statusValue]
      });

      onAddAction({
        target,
        value: 0n,
        calldata,
        targetLabel: getTargetDefinition(template.targetId).label,
        functionName: template.functionName,
        argsPreview: [
          `requestId: ${requestId}`,
          `status: ${statusValue === 1 ? "FROZEN" : "ARCHIVED"}`
        ]
      });

      setForm((prev) => ({ ...prev, requestId: "" }));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to add guided action");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Guided action composer</h3>
        <p className="text-xs text-muted-foreground">
          Uses locked safe presets and maps your choices to ABI calldata automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Template</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={form.templateId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                templateId: e.target.value as GuidedFormState["templateId"]
              }))
            }
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          {currentTemplate ? <span className="text-xs text-muted-foreground">{currentTemplate.description}</span> : null}
        </label>

        {form.templateId === "valuableActionProposal" ? (
          <>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Action title</span>
              <input
                className="rounded border border-border bg-background px-3 py-2"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Weekly moderation sprint"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Reward tier</span>
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.rewardTierId}
                onChange={(e) => setForm((prev) => ({ ...prev, rewardTierId: e.target.value as GuidedFormState["rewardTierId"] }))}
              >
                {GUIDED_REWARD_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Verification strictness</span>
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.strictnessId}
                onChange={(e) => setForm((prev) => ({ ...prev, strictnessId: e.target.value as GuidedFormState["strictnessId"] }))}
              >
                {GUIDED_VERIFICATION_STRICTNESS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Evidence profile</span>
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.evidenceId}
                onChange={(e) => setForm((prev) => ({ ...prev, evidenceId: e.target.value as GuidedFormState["evidenceId"] }))}
              >
                {GUIDED_EVIDENCE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Revocable SBT</span>
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.revocable ? "yes" : "no"}
                onChange={(e) => setForm((prev) => ({ ...prev, revocable: e.target.value === "yes" }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Proposal reference seed (optional)</span>
              <input
                className="rounded border border-border bg-background px-3 py-2"
                value={form.proposalRefSeed}
                onChange={(e) => setForm((prev) => ({ ...prev, proposalRefSeed: e.target.value }))}
                placeholder="Leave empty to auto-generate a unique hash"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Request ID</span>
              <input
                className="rounded border border-border bg-background px-3 py-2"
                value={form.requestId}
                onChange={(e) => setForm((prev) => ({ ...prev, requestId: e.target.value }))}
                placeholder="Ex: 12"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">New status</span>
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.requestStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, requestStatus: e.target.value as GuidedFormState["requestStatus"] }))}
              >
                <option value="1">FROZEN</option>
                <option value="2">ARCHIVED</option>
              </select>
            </label>
          </>
        )}
      </div>

      <button type="button" className="btn-primary-sm" onClick={handleAddGuidedAction}>
        Add guided action
      </button>
    </div>
  );
}

function ExpertActionBuilder({
  chainId,
  resolveTargetAddress,
  onAddAction
}: {
  chainId: number | undefined;
  resolveTargetAddress: (targetId: ActionTargetId) => Address | null;
  onAddAction: (action: PreparedAction) => void;
}) {
  const [form, setForm] = useState<ActionFormState>({ value: "0", paramValues: {}, tupleArrayCounts: {} });

  const targetOptions = useMemo(() => listActionTargets(), []);
  const targetDef = form.targetId ? getTargetDefinition(form.targetId) : undefined;
  const functionOptions = useMemo(() => (form.targetId ? getTargetFunctions(form.targetId) : []), [form.targetId]);
  const selectedFunction = functionOptions.find((fn) => fn.functionName === form.functionName);

  function handleParamChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, paramValues: { ...prev.paramValues, [key]: value } }));
  }

  function handleTupleArrayCountChange(key: string, delta: number) {
    setForm((prev) => {
      const current = prev.tupleArrayCounts[key] ?? 1;
      const next = Math.max(1, current + delta);
      return { ...prev, tupleArrayCounts: { ...prev.tupleArrayCounts, [key]: next } };
    });
  }

  function resetForm() {
    setForm({ value: "0", paramValues: {}, tupleArrayCounts: {} });
  }

  function parseScalar(type: string, raw: string): unknown {
    const trimmed = raw.trim();
    if (type.startsWith("uint")) return BigInt(trimmed || "0");
    if (type === "bool") return trimmed.toLowerCase() === "true";
    if (type === "address") return trimmed as Address;
    if (type.startsWith("bytes")) {
      return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
    }
    return trimmed;
  }

  function getParamValue(key: string) {
    return form.paramValues[key] ?? "";
  }

  function getTupleComponents(param: AbiParameter): readonly AbiParameter[] | null {
    const withComponents = param as AbiParameter & { components?: readonly AbiParameter[] };
    return Array.isArray(withComponents.components) ? withComponents.components : null;
  }

  function buildTupleObject(components: readonly AbiParameter[], baseKey: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    components.forEach((component, idx) => {
      const fieldName = component.name || `field${idx}`;
      const fieldKey = `${baseKey}.${fieldName}`;
      obj[fieldName] = buildValue(component, fieldKey);
    });
    return obj;
  }

  function buildValue(param: AbiParameter, baseKey: string): unknown {
    if (param.type === "tuple") {
      const components = getTupleComponents(param);
      if (!components) throw new Error("Missing tuple components");
      return buildTupleObject(components, baseKey);
    }
    if (param.type === "tuple[]") {
      const components = getTupleComponents(param);
      if (!components) throw new Error("Missing tuple components");
      const count = form.tupleArrayCounts[baseKey] ?? 1;
      return Array.from({ length: count }, (_, i) => buildTupleObject(components, `${baseKey}[${i}]`));
    }
    if (param.type.endsWith("[]")) {
      const base = param.type.slice(0, -2);
      const raw = getParamValue(baseKey);
      if (!raw.trim()) return [];
      return raw.split(",").map((item) => parseScalar(base, item));
    }
    const raw = getParamValue(baseKey);
    return parseScalar(param.type, raw);
  }

  function describeArgs(inputs: AbiFunction["inputs"], paramValues: Record<string, string>) {
    return inputs.map((input, idx) => {
      const key = input.name || `arg${idx}`;
      try {
        const value = buildValue(input, key);
        return `${key || "arg"}${input.type ? ` (${input.type})` : ""}: ${JSON.stringify(value)}`;
      } catch (err) {
        return `${key || "arg"}${input.type ? ` (${input.type})` : ""}: <invalid>`;
      }
    });
  }

  function renderParamInput(input: AbiParameter, idx: number, parentKey?: string) {
    const displayName = input.name || `arg${idx}`;
    const path = parentKey ? `${parentKey}.${displayName}` : displayName;

    const tupleComponents = getTupleComponents(input);

    if (input.type === "tuple[]" && tupleComponents) {
      const count = form.tupleArrayCounts[path] ?? 1;
      return (
        <div key={path} className="space-y-2 rounded border border-border p-3 sm:col-span-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{displayName} (tuple[])</span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => handleTupleArrayCountChange(path, -1)}
              >
                -
              </button>
              <span>{count} item{count === 1 ? "" : "s"}</span>
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => handleTupleArrayCountChange(path, 1)}
              >
                +
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: count }, (_, itemIdx) => (
              <div key={`${path}[${itemIdx}]`} className="rounded border border-dashed border-border p-3">
                <div className="mb-2 text-xs text-muted-foreground">Item {itemIdx + 1}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tupleComponents.map((component, compIdx) =>
                    renderParamInput(component, compIdx, `${path}[${itemIdx}]`)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (input.type === "tuple" && tupleComponents) {
      return (
        <div key={path} className="space-y-2 rounded border border-border p-3 sm:col-span-2">
          <div className="text-sm font-medium">{displayName} (tuple)</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {tupleComponents.map((component, compIdx) => renderParamInput(component, compIdx, path))}
          </div>
        </div>
      );
    }

    const label = `${displayName}${input.type ? ` (${input.type})` : ""}`;
    const placeholder = input.type.endsWith("[]") ? "Comma-separated" : "";

    return (
      <label key={path} className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">{label}</span>
        <input
          className="rounded border border-border bg-background px-3 py-2"
          value={getParamValue(path)}
          onChange={(e) => handleParamChange(path, e.target.value)}
          placeholder={placeholder}
        />
      </label>
    );
  }

  function handleAdd() {
    if (!form.targetId || !selectedFunction) {
      alert("Select a target and action");
      return;
    }

    try {
      const resolved = resolveTargetAddress(form.targetId);
      if (!resolved) {
        throw new Error("Missing target address for selected action in this community");
      }
      const args = selectedFunction.abiFragment.inputs.map((input, idx) => buildValue(input, input.name || `arg${idx}`));

      const value = selectedFunction.abiFragment.stateMutability === "payable" ? BigInt(form.value || "0") : 0n;
      const calldata = encodeFunctionData({
        abi: [selectedFunction.abiFragment],
        functionName: selectedFunction.functionName,
        args
      });

      const prepared: PreparedAction = {
        target: resolved,
        value,
        calldata,
        targetLabel: targetDef?.label ?? form.targetId,
        functionName: selectedFunction.functionName,
        argsPreview: describeArgs(selectedFunction.abiFragment.inputs, form.paramValues)
      };

      onAddAction(prepared);
      resetForm();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to add action");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Add governed action</h3>
          <p className="text-xs text-muted-foreground">
            Only Timelock-executable actions are listed. Pick a target, choose an action, fill params, then add it to this draft. Tuples render nested fields; tuple[] lets you add multiple items.
          </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Target contract</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={form.targetId ?? ""}
            onChange={(e) =>
              setForm({
                targetId: e.target.value as ActionTargetId,
                functionName: undefined,
                paramValues: {},
                tupleArrayCounts: {},
                value: "0"
              })
            }
          >
            <option value="" disabled>
              Select target
            </option>
            {targetOptions.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          {targetDef?.description ? <span className="text-xs text-muted-foreground">{targetDef.description}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Action</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={form.functionName ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, functionName: e.target.value, paramValues: {}, tupleArrayCounts: {} }))}
            disabled={!form.targetId}
          >
            <option value="" disabled>
              {form.targetId ? "Select action" : "Pick a target first"}
            </option>
            {functionOptions.map((fn) => (
              <option key={`${fn.functionName}`} value={fn.functionName}>
                {fn.functionName}
              </option>
            ))}
          </select>
        </label>

        {selectedFunction?.abiFragment.inputs.map((input, idx) => renderParamInput(input, idx))}

        {selectedFunction?.abiFragment.stateMutability === "payable" ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Value (wei)</span>
            <input
              className="rounded border border-border bg-background px-3 py-2"
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
            />
          </label>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAdd}
          className="btn-primary-sm"
          disabled={!form.targetId || !form.functionName}
        >
          Add action
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="btn-ghost"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ActionsTable({ actions, onRemove }: { actions: PreparedAction[]; onRemove: (index: number) => void }) {
  if (!actions.length) {
    return (
      <div className="card-tight bg-muted/30 text-sm text-muted-foreground">
        No actions added yet. Add governed actions above to queue calls for Timelock execution.
      </div>
    );
  }

  return (
    <div className="card-tight space-y-2">
      <h3 className="text-sm font-semibold">Actions queued ({actions.length})</h3>
      <div className="space-y-2 text-sm">
        {actions.map((action, idx) => (
          <div key={`${action.target}-${idx}`} className="flex flex-col gap-1 rounded border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="font-medium">{action.targetLabel} — {action.functionName}</div>
              <div className="text-xs text-muted-foreground">Target: {action.target}</div>
              <div className="text-xs text-muted-foreground">Args: {action.argsPreview.join("; ")}</div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="self-start rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10 sm:self-center"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
