import { describe, expect, it } from "vitest";

import engagementsArtifact from "../abis/Engagements.json" assert { type: "json" };
import { getContractAddress, getContractConfig } from "./contracts";

describe("contracts wiring", () => {
  it("resolves engagements contract from env", () => {
    const original = process.env.NEXT_PUBLIC_ENGAGEMENTS;
    process.env.NEXT_PUBLIC_ENGAGEMENTS = "0x2222222222222222222222222222222222222222";

    try {
      const config = getContractConfig("engagements");

      expect(config.address).toBe(getContractAddress("engagements"));
      expect(config.address).toBe("0x2222222222222222222222222222222222222222");
      expect(config.abi).toEqual(engagementsArtifact.abi);
    } finally {
      if (typeof original === "string") {
        process.env.NEXT_PUBLIC_ENGAGEMENTS = original;
      } else {
        delete process.env.NEXT_PUBLIC_ENGAGEMENTS;
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
