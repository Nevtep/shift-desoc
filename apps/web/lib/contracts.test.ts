import { describe, expect, it } from "vitest";

import communityRegistryArtifact from "../abis/CommunityRegistry.json" assert { type: "json" };
import { getContractAddress, getContractConfig } from "./contracts";

describe("contracts wiring", () => {
  it("resolves community registry contract from env", () => {
    const original = process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY;
    process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY = "0x2222222222222222222222222222222222222222";

    try {
      const config = getContractConfig("communityRegistry");

      expect(config.address).toBe(getContractAddress("communityRegistry"));
      expect(config.address).toBe("0x2222222222222222222222222222222222222222");
      expect(config.abi).toEqual(communityRegistryArtifact.abi);
    } finally {
      if (typeof original === "string") {
        process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY = original;
      } else {
        delete process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY;
      }
    }
  });

  it("resolves governance layer factory strictly from env", () => {
    const original = process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY;
    process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY = "0x1111111111111111111111111111111111111111";

    try {
      expect(getContractAddress("governanceLayerFactory")).toBe(
        "0x1111111111111111111111111111111111111111"
      );
    } finally {
      if (typeof original === "string") {
        process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY = original;
      } else {
        delete process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY;
      }
    }
  });

  it("throws when governance layer factory env is missing", () => {
    const original = process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY;
    delete process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY;

    try {
      expect(() => getContractAddress("governanceLayerFactory")).toThrow(
        /NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY/
      );
    } finally {
      if (typeof original === "string") {
        process.env.NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY = original;
      }
    }
  });
});
