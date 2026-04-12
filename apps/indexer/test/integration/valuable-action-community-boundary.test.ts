import { describe, expect, it } from "vitest";

import { reduceValuableActionLifecycle } from "../../src/valuable-actions/projection";

describe("valuable-action community boundary", () => {
  it("rejects cross-community updates for same action id", () => {
    const created = reduceValuableActionLifecycle(null, {
      kind: "created",
      communityId: 1,
      actionId: 3,
      titleTemplate: "A",
      evidenceSpecCid: null,
      metadataSchemaId: null,
      blockNumber: 1n,
      txHash: "0x1",
    });

    expect(() =>
      reduceValuableActionLifecycle(created, {
        kind: "updated",
        communityId: 2,
        actionId: 3,
        titleTemplate: "B",
        evidenceSpecCid: null,
        metadataSchemaId: null,
        blockNumber: 2n,
        txHash: "0x2",
      })
    ).toThrow(/community boundary violation/i);
  });
});
