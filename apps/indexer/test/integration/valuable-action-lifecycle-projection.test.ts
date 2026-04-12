import { describe, expect, it } from "vitest";

import { reduceValuableActionLifecycle } from "../../src/valuable-actions/projection";

describe("valuable-action lifecycle projection", () => {
  it("applies create/update/activate/deactivate in order", () => {
    const created = reduceValuableActionLifecycle(null, {
      kind: "created",
      communityId: 1,
      actionId: 2,
      titleTemplate: "A",
      evidenceSpecCid: "cid-a",
      metadataSchemaId: "schema-a",
      blockNumber: 10n,
      txHash: "0x1",
    });

    const updated = reduceValuableActionLifecycle(created, {
      kind: "updated",
      communityId: 1,
      actionId: 2,
      titleTemplate: "B",
      evidenceSpecCid: "cid-b",
      metadataSchemaId: "schema-b",
      blockNumber: 11n,
      txHash: "0x2",
    });

    const activated = reduceValuableActionLifecycle(updated, {
      kind: "activated",
      communityId: 1,
      actionId: 2,
      blockNumber: 12n,
      txHash: "0x3",
    });

    const deactivated = reduceValuableActionLifecycle(activated, {
      kind: "deactivated",
      communityId: 1,
      actionId: 2,
      blockNumber: 13n,
      txHash: "0x4",
    });

    expect(deactivated.titleTemplate).toBe("B");
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.activatedAtBlock).toBe(12n);
    expect(deactivated.deactivatedAtBlock).toBe(13n);
    expect(deactivated.lastEventName).toBe("ValuableActionDeactivated");
  });
});
