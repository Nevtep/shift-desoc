import { describe, expect, it } from "vitest";

import communityRegistryArtifact from "../abis/CommunityRegistry.json" assert { type: "json" };
import { getContractAddress, getContractConfig } from "./contracts";

describe("contracts wiring", () => {
  it("resolves community registry contract from setup env", () => {
    const config = getContractConfig("communityRegistry");

    expect(config.address).toBe(getContractAddress("communityRegistry"));
    expect(config.address).toBe("0x0000000000000000000000000000000000000101");
    expect(config.abi).toEqual(communityRegistryArtifact.abi);
  });

  it("resolves governance layer factory from setup env", () => {
    expect(getContractAddress("governanceLayerFactory")).toBe(
      "0x0000000000000000000000000000000000000121"
    );
  });

  it("throws when asking for non env-backed address keys", () => {
    expect(() => getContractAddress("accessManager")).toThrow(/not env-backed/i);
  });
});
