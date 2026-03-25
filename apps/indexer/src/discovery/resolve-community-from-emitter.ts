import { and, desc, eq, lte } from "@ponder/core";
import { emitterMappingWindows } from "../../ponder.schema";

type DbLike = any;

export type ResolveCommunityInput = {
  db: DbLike;
  emitterAddress: string;
  blockNumber: bigint;
  expectedModuleKeys?: readonly string[];
};

export type ResolvedCommunity = {
  communityId: number;
  moduleKey: string;
};

export const resolveCommunityFromEmitter = async (
  input: ResolveCommunityInput
): Promise<ResolvedCommunity | null> => {
  if (typeof input.db.__getEmitterWindows === "function") {
    const rows = (input.db.__getEmitterWindows(input.emitterAddress) ?? []) as any[];
    const sorted = rows.sort((a, b) => {
      if (BigInt(a.activeFromBlock) === BigInt(b.activeFromBlock)) {
        return Number(b.activeFromLogIndex) - Number(a.activeFromLogIndex);
      }
      return BigInt(b.activeFromBlock) > BigInt(a.activeFromBlock) ? 1 : -1;
    });

    const active = sorted.find((row) => {
      if (row.activeToBlock === null || row.activeToBlock === undefined) return true;
      return BigInt(row.activeToBlock) >= input.blockNumber;
    });

    if (!active) return null;

    if (input.expectedModuleKeys && input.expectedModuleKeys.length > 0) {
      if (!input.expectedModuleKeys.includes(active.moduleKey)) {
        return null;
      }
    }

    return {
      communityId: Number(active.communityId),
      moduleKey: String(active.moduleKey),
    };
  }

  const rows = await input.db
    .select()
    .from(emitterMappingWindows)
    .where(
      and(
        eq(emitterMappingWindows.emitterAddress, input.emitterAddress.toLowerCase()),
        lte(emitterMappingWindows.activeFromBlock, input.blockNumber)
      )
    )
    .orderBy(desc(emitterMappingWindows.activeFromBlock), desc(emitterMappingWindows.activeFromLogIndex))
    .limit(10);

  const active = rows.find((row: any) => {
    if (row.activeToBlock === null || row.activeToBlock === undefined) return true;
    return BigInt(row.activeToBlock) >= input.blockNumber;
  });

  if (!active) return null;

  if (input.expectedModuleKeys && input.expectedModuleKeys.length > 0) {
    if (!input.expectedModuleKeys.includes(active.moduleKey)) {
      return null;
    }
  }

  return {
    communityId: Number(active.communityId),
    moduleKey: String(active.moduleKey),
  };
};
