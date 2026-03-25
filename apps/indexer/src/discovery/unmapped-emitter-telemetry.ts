import { unmappedEmitterAlerts } from "../../ponder.schema";

type AlertInput = {
  db: any;
  chainId: number;
  emitterAddress: string;
  moduleKeyHint?: string;
  eventName: string;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  timestamp: Date;
};

const buildAlertId = (chainId: number, txHash: string, logIndex: number) =>
  `unmapped:${chainId}:${txHash.toLowerCase()}:${logIndex}`;

export const writeUnmappedEmitterTelemetry = async (input: AlertInput) => {
  const id = buildAlertId(input.chainId, input.txHash, input.logIndex);

  await input.db
    .insert(unmappedEmitterAlerts)
    .values({
      id,
      chainId: input.chainId,
      emitterAddress: input.emitterAddress.toLowerCase(),
      moduleKeyHint: input.moduleKeyHint ?? null,
      eventName: input.eventName,
      blockNumber: input.blockNumber,
      txHash: input.txHash,
      logIndex: input.logIndex,
      observedAt: input.timestamp,
    })
    .onConflictDoNothing();

  console.warn("[indexer][unmapped-emitter]", {
    chainId: input.chainId,
    emitterAddress: input.emitterAddress,
    eventName: input.eventName,
    blockNumber: input.blockNumber.toString(),
    txHash: input.txHash,
    logIndex: input.logIndex,
    moduleKeyHint: input.moduleKeyHint,
  });
};
