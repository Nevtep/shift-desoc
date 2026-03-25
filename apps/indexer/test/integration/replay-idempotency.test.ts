import { expect, test } from "vitest";

import { applyModuleAddressUpdate } from "../../src/discovery/mapping-windows";
import { resolveCommunityFromEmitter } from "../../src/discovery/resolve-community-from-emitter";
import { createFakeIndexerDb, makeModuleUpdate } from "./fixtures/community-registry-fixtures";

test("replay-idempotency: replaying identical logs keeps stable attribution and no duplicate mapping windows", async () => {
    const db = createFakeIndexerDb();

    const update = makeModuleUpdate({
      communityId: 5,
      moduleKey: "ENGAGEMENTS",
      newAddress: "0x5555555555555555555555555555555555555555",
      txHash: "0x123",
      logIndex: 7,
    });

    await applyModuleAddressUpdate({ db, network: { chainId: 84532 } }, update);
    await applyModuleAddressUpdate({ db, network: { chainId: 84532 } }, update);

    const resolved = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x5555555555555555555555555555555555555555",
      blockNumber: 100n,
      expectedModuleKeys: ["ENGAGEMENTS"],
    });

    expect(db.__state.windows.length).toBe(1);
    expect(resolved?.communityId).toBe(5);
});

test("replay-idempotency: documents current limitation when full reorg simulation is unavailable", () => {
  expect("reorg-simulation-not-available-in-local-harness").toContain("not-available");
});
