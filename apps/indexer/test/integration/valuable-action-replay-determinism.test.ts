import { describe, expect, it } from "vitest";

import { reduceValuableActionLifecycle, type ValuableActionLifecycleEvent } from "../../src/valuable-actions/projection";

describe("valuable-action replay determinism", () => {
  it("produces identical projection for identical replay", () => {
    const events: ValuableActionLifecycleEvent[] = [
      {
        kind: "created",
        communityId: 4,
        actionId: 9,
        titleTemplate: "initial",
        evidenceSpecCid: "cid-1",
        metadataSchemaId: "schema-1",
        blockNumber: 100n,
        txHash: "0xaa",
      },
      {
        kind: "updated",
        communityId: 4,
        actionId: 9,
        titleTemplate: "updated",
        evidenceSpecCid: "cid-2",
        metadataSchemaId: "schema-2",
        blockNumber: 101n,
        txHash: "0xab",
      },
      {
        kind: "activated",
        communityId: 4,
        actionId: 9,
        blockNumber: 102n,
        txHash: "0xac",
      },
    ];

    const replayA = events.reduce((acc, event) => reduceValuableActionLifecycle(acc, event), null as any);
    const replayB = events.reduce((acc, event) => reduceValuableActionLifecycle(acc, event), null as any);

    expect(replayA).toEqual(replayB);
  });
});
