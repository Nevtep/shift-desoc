import { describe, expect, it } from "vitest";

import engagementsArtifact from "../abis/Engagements.json" assert { type: "json" };
import baseSepoliaDeployment from "../../../deployments/base_sepolia.json" assert { type: "json" };
import { getContractAddress, getContractConfig } from "./contracts";

describe("contracts wiring", () => {
  it("resolves canonical engagements contract from deployment manifests", () => {
    expect(baseSepoliaDeployment.addresses.engagements).toBeTruthy();

    const config = getContractConfig("engagements");

    expect(config.address).toBe(getContractAddress("engagements"));
    expect(config.address).toBe(baseSepoliaDeployment.addresses.engagements);
    expect(config.abi).toEqual(engagementsArtifact.abi);
  });
});
