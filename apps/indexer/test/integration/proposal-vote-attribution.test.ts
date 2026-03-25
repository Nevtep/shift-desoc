import { expect, test } from "vitest";

import { applyModuleAddressUpdate } from "../../src/discovery/mapping-windows";
import { resolveCommunityFromEmitter } from "../../src/discovery/resolve-community-from-emitter";
import { createFakeIndexerDb, makeModuleUpdate } from "./fixtures/community-registry-fixtures";

test("proposal-vote-attribution: resolves governor emitter to community for proposal and vote flow", async () => {
    const db = createFakeIndexerDb();

    await applyModuleAddressUpdate(
      { db, network: { chainId: 84532 } },
      makeModuleUpdate({
        communityId: 7,
        moduleKey: "SHIFT_GOVERNOR",
        newAddress: "0x2222222222222222222222222222222222222222",
      })
    );

    const resolved = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x2222222222222222222222222222222222222222",
      blockNumber: 100n,
      expectedModuleKeys: ["SHIFT_GOVERNOR"],
    });

    expect(resolved?.communityId).toBe(7);
    expect(resolved?.moduleKey).toBe("SHIFT_GOVERNOR");
});
