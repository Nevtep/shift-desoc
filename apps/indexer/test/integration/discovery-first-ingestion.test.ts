import { expect, test } from "vitest";
import { keccak256, toBytes } from "viem";

import { applyModuleAddressUpdate } from "../../src/discovery/mapping-windows";
import { normalizeModuleKey } from "../../src/discovery/module-keys";
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

test("discovery-first-ingestion: normalizes keccak module keys emitted by CommunityRegistry", async () => {
    const db = createFakeIndexerDb();
    const hashedRequestHubKey = keccak256(toBytes("requestHub"));

    await applyModuleAddressUpdate(
      {
        db,
        network: { chainId: 84532 },
      },
      makeModuleUpdate({ moduleKey: normalizeModuleKey(hashedRequestHubKey) })
    );

    const resolved = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x1111111111111111111111111111111111111111",
      blockNumber: 100n,
      expectedModuleKeys: ["REQUEST_HUB"],
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.moduleKey).toBe("REQUEST_HUB");
});

test("discovery-first-ingestion: resolves unique active window even if stored module key drifts", async () => {
    const db = createFakeIndexerDb();

    await applyModuleAddressUpdate(
      {
        db,
        network: { chainId: 84532 },
      },
      makeModuleUpdate({ moduleKey: "requestHub" })
    );

    const resolved = await resolveCommunityFromEmitter({
      db,
      emitterAddress: "0x1111111111111111111111111111111111111111",
      blockNumber: 100n,
      expectedModuleKeys: ["REQUEST_HUB"],
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.communityId).toBe(1);
});
