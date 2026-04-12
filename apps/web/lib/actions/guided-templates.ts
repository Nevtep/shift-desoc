import { encodeFunctionData, parseAbiItem, type AbiFunction, type Address, type Hex } from "viem";

import type { AllowlistTargetId } from "./allowlist";
import crucialFlowsCatalogJson from "../../../../specs/010-wizard-permission-parity/contracts/crucial-flows-catalog.json" assert { type: "json" };

type TemplateFieldType =
  | "address"
  | "bool"
  | "string"
  | "bytes32"
  | "uint16"
  | "uint256"
  | "addressArray"
  | "uint256Array";

export type GuidedTemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
};

export type GuidedTemplateDefinition = {
  id: string;
  targetId: AllowlistTargetId;
  signature: string;
  label: string;
  description: string;
  effectCopy: string;
  fields: GuidedTemplateField[];
};

export type GuidedTemplateAvailability = {
  enabled: boolean;
  disabledReason: string | null;
};

export type CrucialFlowCatalogEntry = {
  layer: "coordination" | "governance" | "verification" | "economy" | "commerce_housing";
  flowId: string;
  targetKey: string;
  signature: string;
  templateId: string;
  enabled: boolean;
  disabledReason: string | null;
};

type CrucialFlowCatalog = {
  version: string;
  flows: CrucialFlowCatalogEntry[];
};

const CRUCIAL_FLOW_CATALOG = crucialFlowsCatalogJson as CrucialFlowCatalog;

const GUIDED_TEMPLATES: readonly GuidedTemplateDefinition[] = [
  {
    id: "var.setValuableActionSBT",
    targetId: "valuableActionRegistry",
    signature: "setValuableActionSBT(address)",
    label: "Set ValuableActionSBT",
    description: "Update the SBT contract used for valuable action issuance.",
    effectCopy: "Changes the SBT destination for future issuance events.",
    fields: [{ key: "sbtAddress", label: "SBT address", type: "address", required: true }]
  },
  {
    id: "var.setIssuanceModule",
    targetId: "valuableActionRegistry",
    signature: "setIssuanceModule(address,bool)",
    label: "Toggle issuance module",
    description: "Allow or disallow an issuance module address.",
    effectCopy: "Updates module permission used for issuance calls.",
    fields: [
      { key: "moduleAddress", label: "Module address", type: "address", required: true },
      { key: "enabled", label: "Enabled", type: "bool", required: true }
    ]
  },
  {
    id: "var.addFounder",
    targetId: "valuableActionRegistry",
    signature: "addFounder(address)",
    label: "Add founder",
    description: "Grant founder privileges to an address.",
    effectCopy: "Adds a founder to the founder allowlist.",
    fields: [{ key: "founderAddress", label: "Founder address", type: "address", required: true }]
  },
  {
    id: "var.activateFromGovernance",
    targetId: "valuableActionRegistry",
    signature: "activateFromGovernance(uint256,bytes32)",
    label: "Activate Valuable Action",
    description: "Activate a pending Valuable Action using its ID and governance proposal reference.",
    effectCopy: "Marks the pending Valuable Action as active and executable.",
    fields: [
      { key: "valuableActionId", label: "Valuable Action ID", type: "uint256", required: true, min: 1 },
      { key: "proposalRef", label: "Proposal reference (bytes32)", type: "bytes32", required: true }
    ]
  },
  {
    id: "var.proposeValuableAction",
    targetId: "valuableActionRegistry",
    signature:
      "proposeValuableAction((uint32,uint32,uint32,uint8,bytes32,uint32,uint8,bytes32,uint32,uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64),bytes32)",
    label: "Propose Valuable Action",
    description: "Submit a full Valuable Action payload and proposal reference to governance.",
    effectCopy: "Creates a pending Valuable Action that can later be activated from governance.",
    fields: [
      {
        key: "paramsJson",
        label: "Valuable Action params JSON",
        type: "string",
        required: true,
        maxLength: 12000,
        placeholder:
          '{"membershipTokenReward":0,"communityTokenReward":0,"investorSBTReward":0,"category":1,"rules":"0x...","verifyWindow":604800,"verifierPolicy":1,"metadataCIDHash":"0x...","jurorsMin":2,"panelSize":3,"quorumBps":6000,"minVotingPowerToVote":0,"minVotingPowerToPropose":0,"slashAmount":0,"cooldownPeriod":0,"revocable":true,"evidenceTypes":0,"proposalThreshold":0,"proposer":"0x...","evidenceSpecCID":"ipfs://...","titleTemplate":"Action Title","automationRules":[],"activationDelay":0,"deprecationWarning":0}'
      },
      { key: "proposalRef", label: "Proposal reference (bytes32)", type: "bytes32", required: true }
    ]
  },
  {
    id: "vpt.initializeCommunity",
    targetId: "verifierPowerToken",
    signature: "initializeCommunity(string)",
    label: "Initialize verifier power community",
    description: "Initialize verifier power metadata for this community token set.",
    effectCopy: "Sets initial verifier power metadata URI.",
    fields: [{ key: "metadataURI", label: "Metadata URI", type: "string", required: true, maxLength: 512 }]
  },
  {
    id: "vpt.setURI",
    targetId: "verifierPowerToken",
    signature: "setURI(string)",
    label: "Set verifier power URI",
    description: "Update global URI template for verifier power metadata.",
    effectCopy: "Updates URI used for verifier power metadata rendering.",
    fields: [{ key: "uri", label: "URI", type: "string", required: true, maxLength: 512 }]
  },
  {
    id: "rr.setCommunityTreasury",
    targetId: "revenueRouter",
    signature: "setCommunityTreasury(address)",
    label: "Set community treasury",
    description: "Update treasury destination for routed revenue.",
    effectCopy: "Routes revenue distributions to a new treasury address.",
    fields: [{ key: "treasury", label: "Treasury address", type: "address", required: true }]
  },
  {
    id: "rr.setSupportedToken",
    targetId: "revenueRouter",
    signature: "setSupportedToken(address,bool)",
    label: "Toggle supported token",
    description: "Enable or disable a token in RevenueRouter.",
    effectCopy: "Changes whether a token can be used by RevenueRouter.",
    fields: [
      { key: "token", label: "Token address", type: "address", required: true },
      { key: "enabled", label: "Enabled", type: "bool", required: true }
    ]
  },
  {
    id: "ta.setTokenAllowed",
    targetId: "treasuryAdapter",
    signature: "setTokenAllowed(address,bool)",
    label: "Treasury token allowlist",
    description: "Allow or disallow a token for treasury spending.",
    effectCopy: "Updates treasury token allowlist status.",
    fields: [
      { key: "token", label: "Token address", type: "address", required: true },
      { key: "allowed", label: "Allowed", type: "bool", required: true }
    ]
  },
  {
    id: "ta.setCapBps",
    targetId: "treasuryAdapter",
    signature: "setCapBps(address,uint16)",
    label: "Treasury cap bps",
    description: "Set treasury spend cap in basis points for a token.",
    effectCopy: "Updates per-token treasury spend cap.",
    fields: [
      { key: "token", label: "Token address", type: "address", required: true },
      { key: "capBps", label: "Cap BPS", type: "uint16", required: true, min: 1, max: 10000 }
    ]
  },
  {
    id: "ta.setDestinationAllowed",
    targetId: "treasuryAdapter",
    signature: "setDestinationAllowed(address,bool)",
    label: "Treasury destination allowlist",
    description: "Allow or disallow payout destinations.",
    effectCopy: "Updates destination allowlist for treasury transfers.",
    fields: [
      { key: "destination", label: "Destination address", type: "address", required: true },
      { key: "allowed", label: "Allowed", type: "bool", required: true }
    ]
  },
  {
    id: "mp.setCommunityActive",
    targetId: "marketplace",
    signature: "setCommunityActive(bool)",
    label: "Marketplace community active",
    description: "Enable or disable marketplace activity for this community.",
    effectCopy: "Toggles marketplace availability for the community.",
    fields: [{ key: "active", label: "Active", type: "bool", required: true }]
  },
  {
    id: "mp.setCommunityToken",
    targetId: "marketplace",
    signature: "setCommunityToken(address)",
    label: "Marketplace community token",
    description: "Update marketplace settlement token.",
    effectCopy: "Sets token used for marketplace settlement.",
    fields: [{ key: "token", label: "Token address", type: "address", required: true }]
  },
  {
    id: "ve.setVerifierSet",
    targetId: "verifierElection",
    signature: "setVerifierSet(address[],uint256[],string)",
    label: "Set verifier set",
    description: "Replace verifier roster and weights.",
    effectCopy: "Updates verifier addresses and power weights.",
    fields: [
      { key: "verifiers", label: "Verifier addresses", type: "addressArray", required: true, placeholder: "0xabc...,0xdef..." },
      { key: "powers", label: "Verifier powers", type: "uint256Array", required: true, placeholder: "100,200" },
      { key: "reason", label: "Reason", type: "string", required: true, maxLength: 256 }
    ]
  },
  {
    id: "ve.banVerifiers",
    targetId: "verifierElection",
    signature: "banVerifiers(address[],string)",
    label: "Ban verifiers",
    description: "Ban one or more verifiers with an audit reason.",
    effectCopy: "Bans selected verifiers.",
    fields: [
      { key: "verifiers", label: "Verifier addresses", type: "addressArray", required: true, placeholder: "0xabc...,0xdef..." },
      { key: "reason", label: "Reason", type: "string", required: true, maxLength: 256 }
    ]
  },
  {
    id: "ve.unbanVerifier",
    targetId: "verifierElection",
    signature: "unbanVerifier(address,string)",
    label: "Unban verifier",
    description: "Unban a verifier with an audit note.",
    effectCopy: "Removes ban status from one verifier.",
    fields: [
      { key: "verifier", label: "Verifier address", type: "address", required: true },
      { key: "reason", label: "Reason", type: "string", required: true, maxLength: 256 }
    ]
  },
  {
    id: "ve.adjustVerifierPower",
    targetId: "verifierElection",
    signature: "adjustVerifierPower(address,uint256,string)",
    label: "Adjust verifier power",
    description: "Change verifier power amount with an audit reason.",
    effectCopy: "Updates verifier power token weighting.",
    fields: [
      { key: "verifier", label: "Verifier address", type: "address", required: true },
      { key: "newPower", label: "New power", type: "uint256", required: true, min: 1 },
      { key: "reason", label: "Reason", type: "string", required: true, maxLength: 256 }
    ]
  }
] as const;

function parseBool(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
  if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  throw new Error("Boolean value must be true/false");
}

function parseAddress(raw: string): Address {
  const value = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("Address must be a valid 0x-prefixed 20-byte hex value");
  }
  return value as Address;
}

function parseBytes32(raw: string): `0x${string}` {
  const value = raw.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("Value must be a valid 0x-prefixed 32-byte hex string");
  }
  return value as `0x${string}`;
}

function parseUint(raw: string): bigint {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("Numeric value must be an unsigned integer");
  }
  return BigInt(value);
}

function parseAddressArray(raw: string): Address[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseAddress(entry));
}

function parseUintArray(raw: string): bigint[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseUint(entry));
}

function parseFieldValue(field: GuidedTemplateField, rawValue: string): Address | boolean | string | bigint | Address[] | bigint[] {
  if (!rawValue.trim() && field.required) {
    throw new Error(`${field.label} is required`);
  }

  if (!rawValue.trim()) {
    if (field.type === "bool") return false;
    if (field.type === "addressArray") return [];
    if (field.type === "uint256Array") return [];
    if (field.type === "bytes32") return "0x0000000000000000000000000000000000000000000000000000000000000000";
    if (field.type === "uint16" || field.type === "uint256") return 0n;
    return "";
  }

  if (field.maxLength && rawValue.length > field.maxLength) {
    throw new Error(`${field.label} exceeds max length ${field.maxLength}`);
  }

  switch (field.type) {
    case "address":
      return parseAddress(rawValue);
    case "bool":
      return parseBool(rawValue);
    case "string":
      return rawValue.trim();
    case "bytes32":
      return parseBytes32(rawValue);
    case "uint16": {
      const parsed = parseUint(rawValue);
      if (parsed > 65535n) {
        throw new Error(`${field.label} must fit uint16`);
      }
      if (field.min !== undefined && parsed < BigInt(field.min)) {
        throw new Error(`${field.label} must be >= ${field.min}`);
      }
      if (field.max !== undefined && parsed > BigInt(field.max)) {
        throw new Error(`${field.label} must be <= ${field.max}`);
      }
      return parsed;
    }
    case "uint256": {
      const parsed = parseUint(rawValue);
      if (field.min !== undefined && parsed < BigInt(field.min)) {
        throw new Error(`${field.label} must be >= ${field.min}`);
      }
      if (field.max !== undefined && parsed > BigInt(field.max)) {
        throw new Error(`${field.label} must be <= ${field.max}`);
      }
      return parsed;
    }
    case "addressArray":
      return parseAddressArray(rawValue);
    case "uint256Array":
      return parseUintArray(rawValue);
    default:
      return rawValue.trim();
  }
}

function normalizeBooleanInput(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") return "true";
  if (normalized === "false" || normalized === "no" || normalized === "0") return "false";
  return rawValue;
}

function previewValue(value: Address | boolean | string | bigint | Address[] | bigint[]): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => (typeof item === "bigint" ? item.toString() : String(item))).join(",");
  return String(value);
}

function asObject(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Valuable Action params JSON must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Valuable Action params JSON must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function asUintField(value: unknown, label: string, bits: 8 | 32 | 64): bigint {
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "bigint") {
    throw new Error(`${label} must be an unsigned integer`);
  }

  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isInteger(value))) {
    throw new Error(`${label} must be an unsigned integer`);
  }

  const parsed =
    typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? BigInt(Math.trunc(value))
        : parseUint(value);

  if (parsed < 0n) {
    throw new Error(`${label} must be an unsigned integer`);
  }

  const maxValue = (1n << BigInt(bits)) - 1n;
  if (parsed > maxValue) {
    throw new Error(`${label} exceeds uint${bits}`);
  }

  return parsed;
}

function asUint256Field(value: unknown, label: string): bigint {
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "bigint") {
    throw new Error(`${label} must be an unsigned integer`);
  }
  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isInteger(value))) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  const parsed =
    typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? BigInt(Math.trunc(value))
        : parseUint(value);
  if (parsed < 0n) {
    throw new Error(`${label} must be an unsigned integer`);
  }
  return parsed;
}

function asBoolField(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return parseBool(value);
  throw new Error(`${label} must be a boolean`);
}

function asStringField(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function asBytes32ArrayField(value: unknown, label: string): `0x${string}`[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a bytes32 array`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${label}[${index}] must be a bytes32 string`);
    }
    return parseBytes32(item);
  });
}

function parseValuableActionParamsJson(raw: string): {
  membershipTokenReward: bigint;
  communityTokenReward: bigint;
  investorSBTReward: bigint;
  category: bigint;
  rules: `0x${string}`;
  verifyWindow: bigint;
  verifierPolicy: bigint;
  metadataCIDHash: `0x${string}`;
  jurorsMin: bigint;
  panelSize: bigint;
  quorumBps: bigint;
  minVotingPowerToVote: bigint;
  minVotingPowerToPropose: bigint;
  slashAmount: bigint;
  cooldownPeriod: bigint;
  revocable: boolean;
  evidenceTypes: bigint;
  proposalThreshold: bigint;
  proposer: Address;
  evidenceSpecCID: string;
  titleTemplate: string;
  automationRules: `0x${string}`[];
  activationDelay: bigint;
  deprecationWarning: bigint;
  tupleArgs: readonly unknown[];
} {
  const parsed = asObject(raw);

  const params = {
    membershipTokenReward: asUintField(parsed.membershipTokenReward, "membershipTokenReward", 32),
    communityTokenReward: asUintField(parsed.communityTokenReward, "communityTokenReward", 32),
    investorSBTReward: asUintField(parsed.investorSBTReward, "investorSBTReward", 32),
    category: asUintField(parsed.category, "category", 8),
    rules: parseBytes32(asStringField(parsed.rules, "rules")),
    verifyWindow: asUintField(parsed.verifyWindow, "verifyWindow", 32),
    verifierPolicy: asUintField(parsed.verifierPolicy, "verifierPolicy", 8),
    metadataCIDHash: parseBytes32(asStringField(parsed.metadataCIDHash, "metadataCIDHash")),
    jurorsMin: asUintField(parsed.jurorsMin, "jurorsMin", 32),
    panelSize: asUintField(parsed.panelSize, "panelSize", 32),
    quorumBps: asUintField(parsed.quorumBps, "quorumBps", 32),
    minVotingPowerToVote: asUintField(parsed.minVotingPowerToVote, "minVotingPowerToVote", 32),
    minVotingPowerToPropose: asUintField(parsed.minVotingPowerToPropose, "minVotingPowerToPropose", 32),
    slashAmount: asUintField(parsed.slashAmount, "slashAmount", 32),
    cooldownPeriod: asUintField(parsed.cooldownPeriod, "cooldownPeriod", 32),
    revocable: asBoolField(parsed.revocable, "revocable"),
    evidenceTypes: asUintField(parsed.evidenceTypes, "evidenceTypes", 32),
    proposalThreshold: asUint256Field(parsed.proposalThreshold, "proposalThreshold"),
    proposer: parseAddress(asStringField(parsed.proposer, "proposer")),
    evidenceSpecCID: asStringField(parsed.evidenceSpecCID, "evidenceSpecCID"),
    titleTemplate: asStringField(parsed.titleTemplate, "titleTemplate"),
    automationRules: asBytes32ArrayField(parsed.automationRules, "automationRules"),
    activationDelay: asUintField(parsed.activationDelay, "activationDelay", 64),
    deprecationWarning: asUintField(parsed.deprecationWarning, "deprecationWarning", 64)
  };

  return {
    ...params,
    tupleArgs: [
      params.membershipTokenReward,
      params.communityTokenReward,
      params.investorSBTReward,
      params.category,
      params.rules,
      params.verifyWindow,
      params.verifierPolicy,
      params.metadataCIDHash,
      params.jurorsMin,
      params.panelSize,
      params.quorumBps,
      params.minVotingPowerToVote,
      params.minVotingPowerToPropose,
      params.slashAmount,
      params.cooldownPeriod,
      params.revocable,
      params.evidenceTypes,
      params.proposalThreshold,
      params.proposer,
      params.evidenceSpecCID,
      params.titleTemplate,
      params.automationRules,
      params.activationDelay,
      params.deprecationWarning
    ]
  };
}

export function listGuidedTemplates(): GuidedTemplateDefinition[] {
  return [...GUIDED_TEMPLATES];
}

export function getGuidedTemplateById(templateId: string): GuidedTemplateDefinition | undefined {
  return GUIDED_TEMPLATES.find((template) => template.id === templateId);
}

export function getGuidedTemplateAvailability(
  template: GuidedTemplateDefinition,
  context: { moduleAddress: Address | null; allowlistedSignatures: Set<string> }
): GuidedTemplateAvailability {
  if (!context.moduleAddress) {
    return {
      enabled: false,
      disabledReason: "Module not configured for this community"
    };
  }
  if (!context.allowlistedSignatures.has(template.signature)) {
    return {
      enabled: false,
      disabledReason: "Not timelock-allowlisted for this community"
    };
  }
  return {
    enabled: true,
    disabledReason: null
  };
}

export function listCrucialFlowsCatalog(): CrucialFlowCatalogEntry[] {
  return [...CRUCIAL_FLOW_CATALOG.flows].sort((a, b) => a.flowId.localeCompare(b.flowId));
}

export function resolveCrucialFlowsCatalog(
  getAllowlistedSignatures: (targetId: AllowlistTargetId) => string[]
): CrucialFlowCatalogEntry[] {
  return listCrucialFlowsCatalog().map((flow) => {
    if (flow.templateId.startsWith("disabled.")) {
      return {
        ...flow,
        enabled: false,
        disabledReason: flow.disabledReason ?? "Not representable as safe guided draft template"
      };
    }

    const targetId = flow.targetKey as AllowlistTargetId;
    const allowlisted = new Set(getAllowlistedSignatures(targetId));
    if (!allowlisted.has(flow.signature)) {
      return {
        ...flow,
        enabled: false,
        disabledReason: "Not timelock-executable by current deploy wiring"
      };
    }

    return {
      ...flow,
      enabled: true,
      disabledReason: null
    };
  });
}

export function encodeGuidedTemplateCalldata(template: GuidedTemplateDefinition, rawInput: Record<string, string>): {
  calldata: Hex;
  argsPreview: string[];
} {
  if (template.id === "var.activateFromGovernance") {
    const actionId = parseUint(rawInput.valuableActionId ?? "");
    const proposalRef = parseBytes32(rawInput.proposalRef ?? "");
    const functionFragment = parseAbiItem(`function ${template.signature}`) as AbiFunction;
    const calldata = encodeFunctionData({
      abi: [functionFragment],
      functionName: functionFragment.name,
      args: [actionId, proposalRef]
    });

    return {
      calldata,
      argsPreview: [`valuableActionId: ${actionId.toString()}`, `proposalRef: ${proposalRef}`]
    };
  }

  if (template.id === "var.proposeValuableAction") {
    const params = parseValuableActionParamsJson(rawInput.paramsJson ?? "");
    const proposalRef = parseBytes32(rawInput.proposalRef ?? "");
    const functionFragment = parseAbiItem(`function ${template.signature}`) as AbiFunction;
    const calldata = encodeFunctionData({
      abi: [functionFragment],
      functionName: functionFragment.name,
      args: [params.tupleArgs, proposalRef]
    });

    return {
      calldata,
      argsPreview: [
        `titleTemplate: ${params.titleTemplate}`,
        `category: ${params.category.toString()}`,
        `verifierPolicy: ${params.verifierPolicy.toString()}`,
        `jurorsMin: ${params.jurorsMin.toString()}`,
        `panelSize: ${params.panelSize.toString()}`,
        `proposalRef: ${proposalRef}`
      ]
    };
  }

  const parsedArgs = template.fields.map((field) => parseFieldValue(field, rawInput[field.key] ?? ""));

  if (template.id === "ve.setVerifierSet") {
    const verifiers = parsedArgs[0] as Address[];
    const powers = parsedArgs[1] as bigint[];
    if (verifiers.length === 0 || powers.length === 0) {
      throw new Error("Verifier set requires at least one verifier and power");
    }
    if (verifiers.length !== powers.length) {
      throw new Error("Verifier addresses and powers must have equal length");
    }
    if (powers.some((power) => power <= 0n)) {
      throw new Error("Verifier powers must be greater than 0");
    }
  }

  if (template.id === "ve.banVerifiers") {
    const verifiers = parsedArgs[0] as Address[];
    if (verifiers.length === 0) {
      throw new Error("At least one verifier is required");
    }
  }

  const functionFragment = parseAbiItem(`function ${template.signature}`) as AbiFunction;
  const calldata = encodeFunctionData({
    abi: [functionFragment],
    functionName: functionFragment.name,
    args: parsedArgs
  });

  return {
    calldata,
    argsPreview: template.fields.map((field) => {
      const raw = rawInput[field.key] ?? "";
      const normalized = field.type === "bool" ? normalizeBooleanInput(raw) : raw;
      const parsed = parseFieldValue(field, normalized);
      return `${field.key}: ${previewValue(parsed)}`;
    })
  };
}
