import { expect, test } from "vitest";

import { applyModuleAddressUpdate } from "../../src/discovery/mapping-windows";
import { resolveCommunityFromEmitter } from "../../src/discovery/resolve-community-from-emitter";
import { createFakeIndexerDb, makeModuleUpdate } from "./fixtures/community-registry-fixtures";

test("discovery-first-ingestion: discovers emitter via module update and resolves first request attribution", async () => {
    const db = createFakeIndexerDb();

    await applyModuleAddressUpdate(
      {
        db,
        network: { chainId: 84532 },
      },
      makeModuleUpdate()
    );

    const resolved = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x1111111111111111111111111111111111111111",
      blockNumber: 100n,
      expectedModuleKeys: ["REQUEST_HUB"],
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.communityId).toBe(1);
    expect(resolved?.moduleKey).toBe("REQUEST_HUB");
});
