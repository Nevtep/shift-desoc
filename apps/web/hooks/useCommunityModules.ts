"use client";

import { useMemo } from "react";
import type { Abi, Address } from "viem";
import { useReadContract } from "wagmi";

import { CONTRACTS, getContractConfig } from "../lib/contracts";
import timelockArtifact from "../abis/ShiftTimelockController.json" assert { type: "json" };
import verifierPowerTokenArtifact from "../abis/VerifierPowerToken1155.json" assert { type: "json" };
import verifierElectionArtifact from "../abis/VerifierElection.json" assert { type: "json" };
import verifierManagerArtifact from "../abis/VerifierManager.json" assert { type: "json" };
import valuableActionSBTArtifact from "../abis/ValuableActionSBT.json" assert { type: "json" };
import treasuryAdapterArtifact from "../abis/TreasuryAdapter.json" assert { type: "json" };
import communityTokenArtifact from "../abis/CommunityToken.json" assert { type: "json" };
import paramControllerArtifact from "../abis/ParamController.json" assert { type: "json" };

export type CommunityModules = {
  governor?: Address;
  timelock?: Address;
  requestHub?: Address;
  draftsManager?: Address;
  engagementsManager?: Address;
  valuableActionRegistry?: Address;
  verifierPowerToken?: Address;
  verifierElection?: Address;
  verifierManager?: Address;
  valuableActionSBT?: Address;
  treasuryAdapter?: Address;
  communityToken?: Address;
  paramController?: Address;
};

type HookParams = {
  communityId?: number;
  chainId?: number;
  enabled?: boolean;
};

function parseAddress(value: unknown): Address | undefined {
  if (typeof value !== "string") return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
}

function mapModules(raw: unknown): CommunityModules | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown> & unknown[];

  return {
    governor: parseAddress(value.governor ?? value[0]),
    timelock: parseAddress(value.timelock ?? value[1]),
    requestHub: parseAddress(value.requestHub ?? value[2]),
    draftsManager: parseAddress(value.draftsManager ?? value[3]),
    engagementsManager: parseAddress(value.engagementsManager ?? value[4]),
    valuableActionRegistry: parseAddress(value.valuableActionRegistry ?? value[5]),
    verifierPowerToken: parseAddress(value.verifierPowerToken ?? value[6]),
    verifierElection: parseAddress(value.verifierElection ?? value[7]),
    verifierManager: parseAddress(value.verifierManager ?? value[8]),
    valuableActionSBT: parseAddress(value.valuableActionSBT ?? value[9]),
    treasuryAdapter: parseAddress(value.treasuryAdapter ?? value[11]),
    communityToken: parseAddress(value.communityToken ?? value[12]),
    paramController: parseAddress(value.paramController ?? value[13])
  };
}

export function useCommunityModules({ communityId, chainId, enabled = true }: HookParams) {
  const communityRegistry = useMemo(() => {
    try {
      return getContractConfig("communityRegistry", chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const validCommunityId = Number.isFinite(communityId) && (communityId as number) > 0;

  const query = useReadContract({
    address: communityRegistry?.address,
    abi: communityRegistry?.abi,
    functionName: "getCommunityModules",
    args: validCommunityId ? [BigInt(communityId as number)] : undefined,
    query: {
      enabled: Boolean(enabled && communityRegistry && validCommunityId)
    }
  });

  const modules = useMemo(() => mapModules(query.data), [query.data]);

  return {
    modules,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error
  };
}

export const COMMUNITY_MODULE_ABIS = {
  requestHub: CONTRACTS.requestHub.abi,
  draftsManager: CONTRACTS.draftsManager.abi,
  engagements: CONTRACTS.engagements.abi,
  valuableActionRegistry: CONTRACTS.valuableActionRegistry.abi,
  governor: CONTRACTS.governor.abi,
  timelock: timelockArtifact.abi as Abi,
  verifierPowerToken: verifierPowerTokenArtifact.abi as Abi,
  verifierElection: verifierElectionArtifact.abi as Abi,
  verifierManager: verifierManagerArtifact.abi as Abi,
  valuableActionSBT: valuableActionSBTArtifact.abi as Abi,
  treasuryAdapter: treasuryAdapterArtifact.abi as Abi,
  communityToken: communityTokenArtifact.abi as Abi,
  paramController: paramControllerArtifact.abi as Abi
} as const;
