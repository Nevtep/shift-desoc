import { eq } from "@ponder/core";
import { emitterMappingActive, emitterMappingWindows } from "../../ponder.schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type DbContext = {
  db: any;
  network: { chainId: number };
};

type WindowInput = {
  communityId: number;
  moduleKey: string;
  oldAddress: string;
  newAddress: string;
  blockNumber: bigint;
  logIndex: number;
  txHash: string;
  timestamp: Date;
};

const normalizeAddress = (address: string) => address.toLowerCase();
const isZeroAddress = (address: string) => normalizeAddress(address) === ZERO_ADDRESS;

const openWindowId = (chainId: number, txHash: string, logIndex: number) =>
  `open:${chainId}:${txHash.toLowerCase()}:${logIndex}`;

export const applyModuleAddressUpdate = async (ctx: DbContext, input: WindowInput) => {
  const { db } = ctx;
  const chainId = ctx.network.chainId;
  const oldAddress = normalizeAddress(input.oldAddress);
  const newAddress = normalizeAddress(input.newAddress);

  if (!isZeroAddress(oldAddress)) {
    await db
      .update(emitterMappingWindows, { emitterAddress: oldAddress })
      .set({
        activeToBlock: input.blockNumber,
        activeToLogIndex: Math.max(input.logIndex - 1, 0),
        closedAt: input.timestamp,
      });

    await db
      .delete(emitterMappingActive)
      .where(eq(emitterMappingActive.emitterAddress, oldAddress));
  }

  if (isZeroAddress(newAddress)) {
    return;
  }

  await db
    .insert(emitterMappingWindows)
    .values({
      id: openWindowId(chainId, input.txHash, input.logIndex),
      chainId,
      emitterAddress: newAddress,
      communityId: input.communityId,
      moduleKey: input.moduleKey,
      activeFromBlock: input.blockNumber,
      activeFromLogIndex: input.logIndex,
      activeToBlock: null,
      activeToLogIndex: null,
      discoveredAt: input.timestamp,
      closedAt: null,
    })
    .onConflictDoNothing();

  await db
    .insert(emitterMappingActive)
    .values({
      emitterAddress: newAddress,
      chainId,
      communityId: input.communityId,
      moduleKey: input.moduleKey,
      activeFromBlock: input.blockNumber,
      activeFromLogIndex: input.logIndex,
      updatedAt: input.timestamp,
    })
    .onConflictDoUpdate({
      target: emitterMappingActive.emitterAddress,
      set: {
        chainId,
        communityId: input.communityId,
        moduleKey: input.moduleKey,
        activeFromBlock: input.blockNumber,
        activeFromLogIndex: input.logIndex,
        updatedAt: input.timestamp,
      },
    });
};
