"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";

import paramControllerArtifact from "../abis/ParamController.json" assert { type: "json" };
import type { CommunityModules } from "./useCommunityModules";
import { useCommunityModules } from "./useCommunityModules";
import { useCachedPublicClient } from "./useCachedPublicClient";
import { useIndexerHealth } from "./useIndexerHealth";
import { canEditParameters } from "../lib/community-overview/authority";
import { formatBps, formatIntegerThreshold, formatModuleAddress, formatSeconds } from "../lib/community-overview/formatters";
import { OVERVIEW_PARAMETER_MAPPINGS } from "../lib/community-overview/parameter-mapping";
import { buildOverviewRoutes } from "../lib/community-overview/routes";
import type {
  IndexerHealthState,
  ModuleSummaryItem,
  OverviewHeaderState,
  ParameterSummaryItem
} from "../lib/community-overview/types";
import { ZERO_ADDRESS } from "../lib/community-overview/constants";
import type { Abi } from "viem";

export type OverviewGovernanceParams = {
  debateWindow: bigint;
  voteWindow: bigint;
  executionDelay: bigint;
};

export type OverviewEligibilityParams = {
  proposalThreshold: bigint;
};

export type OverviewRevenuePolicy = {
  minTreasuryBps: number;
  minPositionsBps: number;
  spilloverTarget: number;
  spilloverSplitBpsToTreasury: number;
};

export type OverviewVerifierParams = {
  verifierPanelSize: bigint;
  verifierMin: bigint;
};

export type OverviewRawParameters = {
  governance: OverviewGovernanceParams;
  eligibility: OverviewEligibilityParams;
  revenue: OverviewRevenuePolicy;
  verifier: OverviewVerifierParams;
};

const MODULE_DEFS: Array<{ key: keyof CommunityModules; label: string; moduleKey: string }> = [
  { key: "governor", label: "Governor", moduleKey: "governor" },
  { key: "timelock", label: "Timelock", moduleKey: "timelock" },
  { key: "requestHub", label: "RequestHub", moduleKey: "requestHub" },
  { key: "draftsManager", label: "DraftsManager", moduleKey: "draftsManager" },
  { key: "engagementsManager", label: "Engagements", moduleKey: "engagements" },
  { key: "valuableActionRegistry", label: "ValuableActionRegistry", moduleKey: "valuableActionRegistry" },
  { key: "verifierPowerToken", label: "VerifierPowerToken1155", moduleKey: "verifierPowerToken" },
  { key: "verifierElection", label: "VerifierElection", moduleKey: "verifierElection" },
  { key: "verifierManager", label: "VerifierManager", moduleKey: "verifierManager" },
  { key: "valuableActionSBT", label: "ValuableActionSBT", moduleKey: "valuableActionSBT" },
  { key: "treasuryAdapter", label: "TreasuryAdapter", moduleKey: "treasuryAdapter" },
  { key: "communityToken", label: "CommunityToken", moduleKey: "communityToken" },
  { key: "paramController", label: "ParamController", moduleKey: "paramController" }
];

export function buildOverviewHeaderState(args: {
  communityId: number;
  displayName: string;
  health: IndexerHealthState;
  canEdit: boolean;
}): OverviewHeaderState {
  const routes = buildOverviewRoutes(args.communityId);
  return {
    communityId: args.communityId,
    displayName: args.displayName,
    network: "Base Sepolia",
    environment: "staging",
    health: args.health,
    lastCheckedAt: new Date().toISOString(),
    actions: {
      viewParameters: {
        href: routes.actions.viewParameters,
        enabled: true
      },
      editParameters: {
        href: routes.actions.editParameters,
        enabled: args.canEdit,
        comingSoon: !args.canEdit
      }
    }
  };
}

export function buildModuleSummaryItems(
  modules: CommunityModules | null,
  bytecodes: Partial<Record<keyof CommunityModules, string | null>>
): ModuleSummaryItem[] {
  return MODULE_DEFS.map((def) => {
    const address = modules?.[def.key] ?? null;
    const normalized = address && address !== ZERO_ADDRESS ? address : null;
    const code = bytecodes[def.key];
    const hasCode = Boolean(code && code !== "0x");
    const status = normalized && hasCode ? "present" : "missing";
    return {
      moduleKey: def.moduleKey,
      label: def.label,
      address: normalized,
      shortAddress: formatModuleAddress(normalized),
      hasCode,
      status,
      source: status === "present" ? "on-chain verified" : "unavailable"
    };
  });
}

export function buildParameterSummaryItems(raw: OverviewRawParameters | null): ParameterSummaryItem[] {
  const now = new Date().toISOString();
  const toEntry = (formatted: { display: string; raw: string | null }) => ({
    value: formatted.display,
    rawValue: formatted.raw
  });

  const workersBps = raw ? 10000 - raw.revenue.minTreasuryBps - raw.revenue.minPositionsBps : null;
  const treasuryBps = raw ? raw.revenue.minTreasuryBps : null;
  const investorsBps = raw ? raw.revenue.minPositionsBps : null;

  const byId: Record<string, { value: string; rawValue: string | null }> = {
    "governance.debateWindow": toEntry(formatSeconds(raw?.governance.debateWindow)),
    "governance.votingWindow": toEntry(formatSeconds(raw?.governance.voteWindow)),
    "governance.executionDelay": toEntry(formatSeconds(raw?.governance.executionDelay)),
    "eligibility.proposalThreshold": toEntry(formatIntegerThreshold(raw?.eligibility.proposalThreshold)),
    "economics.revenueSplit.workersBps": toEntry(formatBps(workersBps)),
    "economics.revenueSplit.treasuryBps": toEntry(formatBps(treasuryBps)),
    "economics.revenueSplit.investorsBps": toEntry(formatBps(investorsBps)),
    "verifier.panelSize": toEntry(formatIntegerThreshold(raw?.verifier.verifierPanelSize)),
    "verifier.minimumApprovals": toEntry(formatIntegerThreshold(raw?.verifier.verifierMin))
  };

  return OVERVIEW_PARAMETER_MAPPINGS.map((mapping) => {
    const entry = byId[mapping.id] ?? { value: "unavailable", rawValue: null };
    return {
      id: mapping.id,
      label: mapping.label,
      unit: mapping.unit,
      value: entry.value,
      rawValue: entry.rawValue,
      source: entry.rawValue ? "on-chain verified" : "unavailable",
      lastCheckedAt: now
    };
  });
}

export function useCommunityOverview(communityId: number) {
  const chainId = useChainId();
  const account = useAccount();
  const { modules, isLoading: modulesLoading } = useCommunityModules({ communityId, chainId, enabled: Boolean(communityId) });
  const publicClient = useCachedPublicClient();

  const [bytecodes, setBytecodes] = useState<Partial<Record<keyof CommunityModules, string | null>>>({});
  const [params, setParams] = useState<OverviewRawParameters | null>(null);
  const [paramsError, setParamsError] = useState(false);
  const [paramsLoading, setParamsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!modules || !publicClient.raw) {
        setBytecodes({});
        return;
      }

      const next: Partial<Record<keyof CommunityModules, string | null>> = {};
      for (const def of MODULE_DEFS) {
        const address = modules[def.key];
        if (!address || address === ZERO_ADDRESS) {
          next[def.key] = null;
          continue;
        }

        try {
          next[def.key] = await publicClient.getBytecode({ address });
        } catch {
          next[def.key] = null;
        }
      }

      if (!cancelled) setBytecodes(next);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [modules, publicClient]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!modules?.paramController || !publicClient.raw) {
        setParams(null);
        setParamsError(false);
        setParamsLoading(false);
        return;
      }

      setParamsLoading(true);
      setParamsError(false);
      try {
        const [governance, eligibility, revenue, verifier] = await Promise.all([
          publicClient.readContract<[bigint, bigint, bigint]>({
            address: modules.paramController,
            abi: paramControllerArtifact.abi as Abi,
            functionName: "getGovernanceParams",
            args: [BigInt(communityId)]
          }),
          publicClient.readContract<[bigint, bigint, bigint]>({
            address: modules.paramController,
            abi: paramControllerArtifact.abi as Abi,
            functionName: "getEligibilityParams",
            args: [BigInt(communityId)]
          }),
          publicClient.readContract<[number, number, number, number]>({
            address: modules.paramController,
            abi: paramControllerArtifact.abi as Abi,
            functionName: "getRevenuePolicy",
            args: [BigInt(communityId)]
          }),
          publicClient.readContract<[bigint, bigint, bigint, boolean, bigint, bigint]>({
            address: modules.paramController,
            abi: paramControllerArtifact.abi as Abi,
            functionName: "getVerifierParams",
            args: [BigInt(communityId)]
          })
        ]);

        if (cancelled) return;
        setParams({
          governance: {
            debateWindow: governance[0],
            voteWindow: governance[1],
            executionDelay: governance[2]
          },
          eligibility: {
            proposalThreshold: eligibility[2]
          },
          revenue: {
            minTreasuryBps: revenue[0],
            minPositionsBps: revenue[1],
            spilloverTarget: revenue[2],
            spilloverSplitBpsToTreasury: revenue[3]
          },
          verifier: {
            verifierPanelSize: verifier[0],
            verifierMin: verifier[1]
          }
        });
      } catch {
        if (cancelled) return;
        setParams(null);
        setParamsError(true);
      } finally {
        if (!cancelled) setParamsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [communityId, modules?.paramController, publicClient]);

  const moduleItems = useMemo(() => buildModuleSummaryItems(modules, bytecodes), [modules, bytecodes]);
  const parameterItems = useMemo(() => buildParameterSummaryItems(params), [params]);

  const newestTimestamp = useMemo(() => {
    const latest = parameterItems[0]?.lastCheckedAt;
    return latest ?? null;
  }, [parameterItems]);
  const indexer = useIndexerHealth(newestTimestamp);

  const allowEdit = canEditParameters({
    connected: account.status === "connected",
    modules
  });

  const header = useMemo(() => {
    return buildOverviewHeaderState({
      communityId,
      displayName: `Community #${communityId}`,
      health: indexer.state,
      canEdit: allowEdit
    });
  }, [allowEdit, communityId, indexer.state]);

  return {
    header,
    moduleItems,
    parameterItems,
    modulesLoading,
    paramsLoading,
    paramsError,
    indexer,
    hasData: Boolean(modules)
  };
}
