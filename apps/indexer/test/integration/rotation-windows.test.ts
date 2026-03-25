import { expect, test } from "vitest";

import { applyModuleAddressUpdate } from "../../src/discovery/mapping-windows";
import { resolveCommunityFromEmitter } from "../../src/discovery/resolve-community-from-emitter";
import { createFakeIndexerDb, makeModuleUpdate } from "./fixtures/community-registry-fixtures";

test("rotation-windows: closes old emitter, opens new emitter, and supports zero-address deactivation", async () => {
    const db = createFakeIndexerDb();

    await applyModuleAddressUpdate(
      { db, network: { chainId: 84532 } },
      makeModuleUpdate({
        communityId: 2,
        moduleKey: "DRAFTS_MANAGER",
        newAddress: "0x3333333333333333333333333333333333333333",
      })
    );

    await applyModuleAddressUpdate(
      { db, network: { chainId: 84532 } },
      makeModuleUpdate({
        communityId: 2,
        moduleKey: "DRAFTS_MANAGER",
        oldAddress: "0x3333333333333333333333333333333333333333",
        newAddress: "0x4444444444444444444444444444444444444444",
        blockNumber: 120n,
        logIndex: 2,
        txHash: "0xdef",
      })
    );

    const before = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x3333333333333333333333333333333333333333",
      blockNumber: 110n,
      expectedModuleKeys: ["DRAFTS_MANAGER"],
    });

    const after = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x4444444444444444444444444444444444444444",
      blockNumber: 120n,
      expectedModuleKeys: ["DRAFTS_MANAGER"],
    });

    await applyModuleAddressUpdate(
      { db, network: { chainId: 84532 } },
      makeModuleUpdate({
        communityId: 2,
        moduleKey: "DRAFTS_MANAGER",
        oldAddress: "0x4444444444444444444444444444444444444444",
        newAddress: "0x0000000000000000000000000000000000000000",
        blockNumber: 140n,
        logIndex: 1,
        txHash: "0xghi",
      })
    );

    const afterDeactivation = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x4444444444444444444444444444444444444444",
      blockNumber: 145n,
      expectedModuleKeys: ["DRAFTS_MANAGER"],
    });

    expect(before?.communityId).toBe(2);
    expect(after?.communityId).toBe(2);
    expect(afterDeactivation).toBeNull();
});
