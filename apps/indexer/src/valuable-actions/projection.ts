export type ValuableActionProjectionState = {
  communityId: number;
  actionId: number;
  titleTemplate: string | null;
  evidenceSpecCid: string | null;
  metadataSchemaId: string | null;
  isActive: boolean;
  createdAtBlock: bigint;
  updatedAtBlock: bigint;
  activatedAtBlock: bigint | null;
  deactivatedAtBlock: bigint | null;
  lastEventTxHash: string;
  lastEventName: string;
};

export type ValuableActionLifecycleEvent =
  | {
      kind: "created";
      communityId: number;
      actionId: number;
      titleTemplate: string | null;
      evidenceSpecCid: string | null;
      metadataSchemaId: string | null;
      blockNumber: bigint;
      txHash: string;
    }
  | {
      kind: "updated";
      communityId: number;
      actionId: number;
      titleTemplate: string | null;
      evidenceSpecCid: string | null;
      metadataSchemaId: string | null;
      blockNumber: bigint;
      txHash: string;
    }
  | {
      kind: "activated";
      communityId: number;
      actionId: number;
      blockNumber: bigint;
      txHash: string;
    }
  | {
      kind: "deactivated";
      communityId: number;
      actionId: number;
      blockNumber: bigint;
      txHash: string;
    };

export function reduceValuableActionLifecycle(
  current: ValuableActionProjectionState | null,
  event: ValuableActionLifecycleEvent
): ValuableActionProjectionState {
  if (event.kind === "created" || !current) {
    if (event.kind !== "created") {
      throw new Error("lifecycle out of order: non-create event without create");
    }

    return {
      communityId: event.communityId,
      actionId: event.actionId,
      titleTemplate: event.titleTemplate,
      evidenceSpecCid: event.evidenceSpecCid,
      metadataSchemaId: event.metadataSchemaId,
      isActive: false,
      createdAtBlock: event.blockNumber,
      updatedAtBlock: event.blockNumber,
      activatedAtBlock: null,
      deactivatedAtBlock: null,
      lastEventTxHash: event.txHash,
      lastEventName: "ValuableActionCreated",
    };
  }

  if (current.communityId !== event.communityId) {
    throw new Error("community boundary violation");
  }

  if (current.actionId !== event.actionId) {
    throw new Error("action id mismatch");
  }

  switch (event.kind) {
    case "updated":
      return {
        ...current,
        titleTemplate: event.titleTemplate,
        evidenceSpecCid: event.evidenceSpecCid,
        metadataSchemaId: event.metadataSchemaId,
        updatedAtBlock: event.blockNumber,
        lastEventTxHash: event.txHash,
        lastEventName: "ValuableActionUpdated",
      };
    case "activated":
      return {
        ...current,
        isActive: true,
        updatedAtBlock: event.blockNumber,
        activatedAtBlock: event.blockNumber,
        lastEventTxHash: event.txHash,
        lastEventName: "ValuableActionActivated",
      };
    case "deactivated":
      return {
        ...current,
        isActive: false,
        updatedAtBlock: event.blockNumber,
        deactivatedAtBlock: event.blockNumber,
        lastEventTxHash: event.txHash,
        lastEventName: "ValuableActionDeactivated",
      };
    default:
      return current;
  }
}

export function toValuableActionProjectionId(communityId: number, actionId: number) {
  return `${communityId}:${actionId}`;
}
