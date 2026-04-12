import { describe, expect, it } from "vitest";

import { reduceValuableActionLifecycle } from "../../src/valuable-actions/projection";

describe("valuable action activation roundtrip", () => {
  it("supports deactivate then activate roundtrip", () => {
    const created = reduceValuableActionLifecycle(null, {
      kind: "created",
      communityId: 1,
      actionId: 5,
      titleTemplate: "A",
      evidenceSpecCid: null,
      metadataSchemaId: null,
      blockNumber: 1n,
      txHash: "0x1",
    });

    const deactivated = reduceValuableActionLifecycle(created, {
      kind: "deactivated",
      communityId: 1,
      actionId: 5,
      blockNumber: 2n,
      txHash: "0x2",
    });

    const activated = reduceValuableActionLifecycle(deactivated, {
      kind: "activated",
      communityId: 1,
      actionId: 5,
      blockNumber: 3n,
      txHash: "0x3",
    });

    expect(activated.isActive).toBe(true);
    expect(activated.activatedAtBlock).toBe(3n);
    expect(activated.lastEventName).toBe("ValuableActionActivated");
  });
});
