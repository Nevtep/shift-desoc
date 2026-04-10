"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex,
  type AbiParameter,
} from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";

import { getContractConfig } from "../../lib/contracts";
import { COMMUNITY_MODULE_ABIS } from "../../hooks/useCommunityModules";
import { useToast } from "../ui/toaster";
import {
  getAllowlistedSignatures,
  getAllowlistedSignatureSet,
  type AllowlistTargetId
} from "../../lib/actions/allowlist";
import { computeActionsHash } from "../../lib/actions/bundle-hash";
import {
  getAllowlistedFunctionsForTarget,
  type AllowlistedFunctionDefinition
} from "../../lib/actions/expert-functions";
import {
  encodeGuidedTemplateCalldata,
  getGuidedTemplateAvailability,
  getGuidedTemplateById,
  listGuidedTemplates
} from "../../lib/actions/guided-templates";
import {
  buildTargetAvailability,
  resolveTargetAddress,
  type ActionTargetAvailability,
  type CommunityModuleAddressMap
} from "../../lib/actions/target-resolution";
import {
  getTargetAbi,
  getTargetDefinition,
  listActionTargetIds,
  listActionTargets,
  type ActionTargetId
} from "../../lib/actions/registry";

export type PreparedAction = {
  targetId?: ActionTargetId;
  target: Address;
  value: bigint;
  calldata: Hex;
  targetLabel: string;
  functionSignature: string;
  argsPreview: string[];
};

type ActionFormState = {
  targetId?: ActionTargetId;
  signature?: string;
  value: string;
  paramValues: Record<string, string>;
  tupleArrayCounts: Record<string, number>;
};

type ActionComposerMode = "guided" | "expert";

type GuidedFormState = {
  templateId: string;
  inputValues: Record<string, string>;
};

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

  const moduleAddressMap = useMemo<CommunityModuleAddressMap>(() => {
    if (!moduleAddresses) return {};

    const modules = moduleAddresses as unknown as Record<string, Address> & Address[];
    return {
      membershipToken: modules.membershipToken ?? modules[1],
      draftsManager: modules.draftsManager ?? modules[6],
      engagements: modules.engagementsManager ?? modules[7],
      valuableActionRegistry: modules.valuableActionRegistry ?? modules[8],
      verifierPowerToken: modules.verifierPowerToken ?? modules[9],
      verifierElection: modules.verifierElection ?? modules[10],
      verifierManager: modules.verifierManager ?? modules[11],
      valuableActionSBT: modules.valuableActionSBT ?? modules[12],
      positionManager: modules.positionManager ?? modules[13],
      credentialManager: modules.credentialManager ?? modules[14],
      cohortRegistry: modules.cohortRegistry ?? modules[15],
      investmentCohortManager: modules.investmentCohortManager ?? modules[16],
      revenueRouter: modules.revenueRouter ?? modules[17],
      treasuryAdapter: modules.treasuryAdapter ?? modules[19],
      paramController: modules.paramController ?? modules[21],
      commerceDisputes: modules.commerceDisputes ?? modules[22],
      marketplace: modules.marketplace ?? modules[23],
      housingManager: modules.housingManager ?? modules[24]
    };
  }, [moduleAddresses]);

  const timelockAddress = (moduleAddresses as any)?.timelock ?? (moduleAddresses as any)?.[3] ?? null;
  const targetIds = useMemo(() => listActionTargetIds(), []);

  const targetAvailability = useMemo(() => {
    return buildTargetAvailability(targetIds, chainId, moduleAddressMap, (targetId) => getAllowlistedSignatures(targetId));
  }, [targetIds, chainId, moduleAddressMap]);

  const targetAvailabilityMap = useMemo(() => {
    return targetAvailability.reduce<Record<ActionTargetId, ActionTargetAvailability>>((acc, availability) => {
      acc[availability.targetId] = availability;
      return acc;
    }, {} as Record<ActionTargetId, ActionTargetAvailability>);
  }, [targetAvailability]);

  const allowlistedSignatureMap = useMemo(() => {
    return targetIds.reduce<Record<ActionTargetId, Set<string>>>((acc, targetId) => {
      acc[targetId] = getAllowlistedSignatureSet(targetId);
      return acc;
    }, {} as Record<ActionTargetId, Set<string>>);
  }, [targetIds]);

  function resolveActionTarget(targetId: AllowlistTargetId): Address | null {
    try {
      return resolveTargetAddress(targetId, chainId, moduleAddressMap);
    } catch {
      return null;
    }
  }

  function handleRemoveAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMoveAction(index: number, direction: -1 | 1) {
    setActions((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
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
                signatures: actions.map((action) => action.functionSignature)
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
      const actionsHash = computeActionsHash(targets, values, calldatas);

      const contractAddress = (moduleAddresses as any)?.draftsManager ?? (moduleAddresses as any)?.[6];
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
            Composer mode: {isExpertMode ? "Expert (allowlist-only exact signatures)" : "Guided (SAFE-only templates)"}
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
            targetAvailability={targetAvailabilityMap}
            allowlistedSignatureMap={allowlistedSignatureMap}
            resolveTargetAddress={resolveActionTarget}
            onAddAction={(action) => setActions((prev) => [...prev, action])}
          />
        ) : (
          <GuidedActionBuilder
            targetAvailability={targetAvailabilityMap}
            allowlistedSignatureMap={allowlistedSignatureMap}
            resolveTargetAddress={resolveActionTarget}
            onAddAction={(action) => setActions((prev) => [...prev, action])}
          />
        )}

        <ActionsTable actions={actions} onRemove={handleRemoveAction} onMove={handleMoveAction} />

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

export function GuidedActionBuilder({
  targetAvailability,
  allowlistedSignatureMap,
  resolveTargetAddress,
  onAddAction
}: {
  targetAvailability: Record<ActionTargetId, ActionTargetAvailability>;
  allowlistedSignatureMap: Record<ActionTargetId, Set<string>>;
  resolveTargetAddress: (targetId: ActionTargetId) => Address | null;
  onAddAction: (action: PreparedAction) => void;
}) {
  const templates = useMemo(() => listGuidedTemplates(), []);
  const [form, setForm] = useState<GuidedFormState>({
    templateId: templates[0]?.id ?? "",
    inputValues: {}
  });

  const selectedTemplate = getGuidedTemplateById(form.templateId);
  const availability = selectedTemplate
    ? getGuidedTemplateAvailability(selectedTemplate, {
        moduleAddress: targetAvailability[selectedTemplate.targetId]?.moduleAddress ?? null,
        allowlistedSignatures: allowlistedSignatureMap[selectedTemplate.targetId]
      })
    : { enabled: false, disabledReason: "Select a template" };

  function updateInput(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      inputValues: {
        ...prev.inputValues,
        [key]: value
      }
    }));
  }

  function handleTemplateChange(templateId: string) {
    setForm({ templateId, inputValues: {} });
  }

  function handleAddGuidedAction() {
    if (!selectedTemplate) {
      alert("Select a template");
      return;
    }
    if (!availability.enabled) {
      alert(availability.disabledReason ?? "Template is unavailable");
      return;
    }

    const target = resolveTargetAddress(selectedTemplate.targetId);
    if (!target) {
      alert("Selected target is not configured for this community");
      return;
    }

    try {
      const encoded = encodeGuidedTemplateCalldata(selectedTemplate, form.inputValues);
      onAddAction({
        targetId: selectedTemplate.targetId,
        target,
        value: 0n,
        calldata: encoded.calldata,
        targetLabel: getTargetDefinition(selectedTemplate.targetId).label,
        functionSignature: selectedTemplate.signature,
        argsPreview: encoded.argsPreview
      });
      setForm((prev) => ({ ...prev, inputValues: {} }));
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
          SAFE-only templates with explicit input validation and exact allowlisted signatures.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Template</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={form.templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            {templates.map((template) => {
              const templateAvailability = getGuidedTemplateAvailability(template, {
                moduleAddress: targetAvailability[template.targetId]?.moduleAddress ?? null,
                allowlistedSignatures: allowlistedSignatureMap[template.targetId]
              });
              return (
                <option key={template.id} value={template.id} disabled={!templateAvailability.enabled}>
                  {template.label}{!templateAvailability.enabled ? " (unavailable)" : ""}
                </option>
              );
            })}
          </select>
          {selectedTemplate ? <span className="text-xs text-muted-foreground">{selectedTemplate.description}</span> : null}
          {!availability.enabled && availability.disabledReason ? (
            <span className="text-xs text-amber-600">{availability.disabledReason}</span>
          ) : null}
        </label>

        {selectedTemplate?.fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{field.label}</span>
            {field.type === "bool" ? (
              <select
                className="rounded border border-border bg-background px-3 py-2"
                value={form.inputValues[field.key] ?? "false"}
                onChange={(e) => updateInput(field.key, e.target.value)}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                className="rounded border border-border bg-background px-3 py-2"
                value={form.inputValues[field.key] ?? ""}
                onChange={(e) => updateInput(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}
          </label>
        ))}
      </div>

      <button type="button" className="btn-primary-sm" onClick={handleAddGuidedAction} disabled={!availability.enabled}>
        Add guided action
      </button>
    </div>
  );
}

export function ExpertActionBuilder({
  targetAvailability,
  allowlistedSignatureMap,
  resolveTargetAddress,
  onAddAction
}: {
  targetAvailability: Record<ActionTargetId, ActionTargetAvailability>;
  allowlistedSignatureMap: Record<ActionTargetId, Set<string>>;
  resolveTargetAddress: (targetId: ActionTargetId) => Address | null;
  onAddAction: (action: PreparedAction) => void;
}) {
  const [form, setForm] = useState<ActionFormState>({ value: "0", paramValues: {}, tupleArrayCounts: {} });

  const targetOptions = useMemo(() => listActionTargets(), []);
  const targetDef = form.targetId ? getTargetDefinition(form.targetId) : undefined;
  const targetState = form.targetId ? targetAvailability[form.targetId] : undefined;

  const functionOptions = useMemo(() => {
    if (!form.targetId) return [] as AllowlistedFunctionDefinition[];
    return getAllowlistedFunctionsForTarget(getTargetAbi(form.targetId), getAllowlistedSignatures(form.targetId));
  }, [form.targetId]);

  const selectedFunction = functionOptions.find((fn) => fn.signature === form.signature);

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

  function parseScalar(type: string, raw: string, fieldKey?: string): unknown {
    const trimmed = raw.trim();
    if (type.startsWith("uint")) return BigInt(trimmed || "0");
    if (type === "bool") return trimmed.toLowerCase() === "true";
    if (type === "address") return trimmed as Address;
    if (type.startsWith("bytes")) {
      const fieldLabel = fieldKey ?? "bytes field";
      const normalized = (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
      const fixedBytesMatch = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);

      if (type === "bytes") {
        if (!trimmed) return "0x" as Hex;
        if (!/^0x[0-9a-fA-F]*$/.test(normalized)) {
          throw new Error(`Invalid hex value for ${fieldLabel}`);
        }
        if ((normalized.length - 2) % 2 !== 0) {
          throw new Error(`Hex value for ${fieldLabel} must contain full bytes`);
        }
        return normalized;
      }

      if (fixedBytesMatch) {
        const expectedBytes = Number(fixedBytesMatch[1]);
        if (!trimmed) {
          throw new Error(`Missing value for ${fieldLabel} (${type})`);
        }
        if (!/^0x[0-9a-fA-F]*$/.test(normalized)) {
          throw new Error(`Invalid hex value for ${fieldLabel} (${type})`);
        }
        if ((normalized.length - 2) % 2 !== 0) {
          throw new Error(`Hex value for ${fieldLabel} (${type}) must contain full bytes`);
        }
        const actualBytes = (normalized.length - 2) / 2;
        if (actualBytes !== expectedBytes) {
          throw new Error(`Size of ${fieldLabel} (${type}) must be exactly ${expectedBytes} bytes`);
        }
        return normalized;
      }

      return normalized;
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
      return raw.split(",").map((item) => parseScalar(base, item, baseKey));
    }
    const raw = getParamValue(baseKey);
    return parseScalar(param.type, raw, baseKey);
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

    if (!allowlistedSignatureMap[form.targetId]?.has(selectedFunction.signature)) {
      alert("Selected function is not timelock-allowlisted");
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
        functionName: selectedFunction.abiFragment.name,
        args
      });

      const prepared: PreparedAction = {
        targetId: form.targetId,
        target: resolved,
        value,
        calldata,
        targetLabel: targetDef?.label ?? form.targetId,
        functionSignature: selectedFunction.signature,
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
          Expert mode is exact-signature allowlist only. Targets stay visible even when disabled.
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
                signature: undefined,
                paramValues: {},
                tupleArrayCounts: {},
                value: "0"
              })
            }
          >
            <option value="" disabled>
              Select target
            </option>
            {targetOptions.map((target) => {
              const availability = targetAvailability[target.id];
              return (
                <option key={target.id} value={target.id} disabled={!availability?.enabled}>
                  {target.label}
                  {availability?.enabled ? "" : ` (disabled: ${availability?.disabledReason ?? "unavailable"})`}
                </option>
              );
            })}
          </select>
          {targetDef?.description ? <span className="text-xs text-muted-foreground">{targetDef.description}</span> : null}
          {!targetState?.enabled && targetState?.disabledReason ? (
            <span className="text-xs text-amber-600">{targetState.disabledReason}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Action signature</span>
          <select
            className="rounded border border-border bg-background px-3 py-2"
            value={form.signature ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, signature: e.target.value, paramValues: {}, tupleArrayCounts: {} }))}
            disabled={!form.targetId || !targetState?.enabled}
          >
            <option value="" disabled>
              {form.targetId ? "Select action" : "Pick a target first"}
            </option>
            {functionOptions.map((fn) => (
              <option key={fn.signature} value={fn.signature}>
                {fn.signature}
              </option>
            ))}
          </select>
          {form.targetId ? (
            <span className="text-xs text-muted-foreground">
              Allowlisted functions: {targetAvailability[form.targetId]?.allowlistedCount ?? 0}
            </span>
          ) : null}
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
          disabled={!form.targetId || !form.signature}
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

export function ActionsTable({
  actions,
  onRemove,
  onMove
}: {
  actions: PreparedAction[];
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="card-tight space-y-2">
      <h3 className="text-sm font-semibold">Actions queued ({actions.length})</h3>
      {!actions.length ? (
        <div className="text-sm text-muted-foreground">Queue is empty. Add governed actions above to compose deterministic bundles.</div>
      ) : (
        <div className="space-y-2 text-sm">
          {actions.map((action, idx) => (
            <div key={`${action.target}-${idx}`} className="flex flex-col gap-2 rounded border border-border p-2">
              <div className="space-y-1">
                <div className="font-medium">{action.targetLabel} - {action.functionSignature}</div>
                <div className="text-xs text-muted-foreground">Target: {action.target}</div>
                <div className="text-xs text-muted-foreground">Args: {action.argsPreview.join("; ")}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onMove(idx, -1)} className="rounded border border-border px-2 py-1 text-xs" disabled={idx === 0}>Move up</button>
                <button type="button" onClick={() => onMove(idx, 1)} className="rounded border border-border px-2 py-1 text-xs" disabled={idx === actions.length - 1}>Move down</button>
                <button type="button" onClick={() => onRemove(idx)} className="rounded border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
