"use client";

import { useEffect, useMemo, useState } from "react";
import type { Abi, Address } from "viem";

import { CONTRACTS, getContractConfig } from "../lib/contracts";
import { useCachedPublicClient } from "./useCachedPublicClient";
import timelockArtifact from "../abis/ShiftTimelockController.json" assert { type: "json" };
import verifierPowerTokenArtifact from "../abis/VerifierPowerToken1155.json" assert { type: "json" };
import verifierElectionArtifact from "../abis/VerifierElection.json" assert { type: "json" };
import verifierManagerArtifact from "../abis/VerifierManager.json" assert { type: "json" };
import valuableActionSBTArtifact from "../abis/ValuableActionSBT.json" assert { type: "json" };
import treasuryAdapterArtifact from "../abis/TreasuryAdapter.json" assert { type: "json" };
import communityTokenArtifact from "../abis/CommunityToken.json" assert { type: "json" };
import paramControllerArtifact from "../abis/ParamController.json" assert { type: "json" };

export type CommunityModules = {
  accessManager?: Address;
  membershipToken?: Address;
  governor?: Address;
  timelock?: Address;
  countingMultiChoice?: Address;
  requestHub?: Address;
  draftsManager?: Address;
  engagementsManager?: Address;
  valuableActionRegistry?: Address;
  verifierPowerToken?: Address;
  verifierElection?: Address;
  verifierManager?: Address;
  valuableActionSBT?: Address;
  positionManager?: Address;
  credentialManager?: Address;
  cohortRegistry?: Address;
  investmentCohortManager?: Address;
  revenueRouter?: Address;
  treasuryVault?: Address;
  treasuryAdapter?: Address;
  communityToken?: Address;
  paramController?: Address;
  commerceDisputes?: Address;
  marketplace?: Address;
  housingManager?: Address;
  projectFactory?: Address;
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
    accessManager: parseAddress(value.accessManager ?? value[0]),
    membershipToken: parseAddress(value.membershipToken ?? value[1]),
    governor: parseAddress(value.governor ?? value[2]),
    timelock: parseAddress(value.timelock ?? value[3]),
    countingMultiChoice: parseAddress(value.countingMultiChoice ?? value[4]),
    requestHub: parseAddress(value.requestHub ?? value[5]),
    draftsManager: parseAddress(value.draftsManager ?? value[6]),
    engagementsManager: parseAddress(value.engagementsManager ?? value[7]),
    valuableActionRegistry: parseAddress(value.valuableActionRegistry ?? value[8]),
    verifierPowerToken: parseAddress(value.verifierPowerToken ?? value[9]),
    verifierElection: parseAddress(value.verifierElection ?? value[10]),
    verifierManager: parseAddress(value.verifierManager ?? value[11]),
    valuableActionSBT: parseAddress(value.valuableActionSBT ?? value[12]),
    positionManager: parseAddress(value.positionManager ?? value[13]),
    credentialManager: parseAddress(value.credentialManager ?? value[14]),
    cohortRegistry: parseAddress(value.cohortRegistry ?? value[15]),
    investmentCohortManager: parseAddress(value.investmentCohortManager ?? value[16]),
    revenueRouter: parseAddress(value.revenueRouter ?? value[17]),
    treasuryVault: parseAddress(value.treasuryVault ?? value[18]),
    treasuryAdapter: parseAddress(value.treasuryAdapter ?? value[19]),
    communityToken: parseAddress(value.communityToken ?? value[20]),
    paramController: parseAddress(value.paramController ?? value[21]),
    commerceDisputes: parseAddress(value.commerceDisputes ?? value[22]),
    marketplace: parseAddress(value.marketplace ?? value[23]),
    housingManager: parseAddress(value.housingManager ?? value[24]),
    projectFactory: parseAddress(value.projectFactory ?? value[25])
  };
}

export function useCommunityModules({ communityId, chainId, enabled = true }: HookParams) {
  const publicClient = useCachedPublicClient();
  const [modules, setModules] = useState<CommunityModules | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const communityRegistry = useMemo(() => {
    try {
      return getContractConfig("communityRegistry", chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const validCommunityId = Number.isFinite(communityId) && (communityId as number) > 0;

  useEffect(() => {
    let cancelled = false;
    const canQuery = Boolean(enabled && communityRegistry && validCommunityId && publicClient.raw);

    if (!canQuery) {
      setModules(null);
      setIsLoading(false);
      setIsFetching(false);
      setIsError(false);
      setError(null);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setIsFetching(true);
      setIsError(false);
      setError(null);

      try {
        const data = await publicClient.readContract({
          address: communityRegistry!.address,
          abi: communityRegistry!.abi,
          functionName: "getCommunityModules",
          args: [BigInt(communityId as number)]
        }, 20_000);

        if (cancelled) return;
        setModules(mapModules(data));
      } catch (readError) {
        if (cancelled) return;
        setModules(null);
        setIsError(true);
        setError(readError instanceof Error ? readError : new Error(String(readError)));
      } finally {
        if (cancelled) return;
        setIsLoading(false);
        setIsFetching(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [communityId, communityRegistry, enabled, publicClient, validCommunityId]);

  return {
    modules,
    isLoading,
    isFetching,
    isError,
    error
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
