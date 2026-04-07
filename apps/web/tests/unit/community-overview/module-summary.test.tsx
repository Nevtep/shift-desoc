import { describe, expect, it } from "vitest";

import type { CommunityModules } from "../../../hooks/useCommunityModules";
import { buildModuleSummaryItems } from "../../../hooks/useCommunityOverview";

describe("community overview module summary", () => {
  it("marks module present when address exists and has bytecode", () => {
    const modules: CommunityModules = {
      governor: "0x0000000000000000000000000000000000000101"
    };
    const items = buildModuleSummaryItems(modules, {
      governor: "0x1234"
    });

    const governor = items.find((item) => item.moduleKey === "governor");
    expect(governor?.status).toBe("present");
    expect(governor?.source).toBe("on-chain verified");
  });

  it("marks module missing when bytecode is unavailable", () => {
    const modules: CommunityModules = {
      governor: "0x0000000000000000000000000000000000000101"
    };
    const items = buildModuleSummaryItems(modules, {
      governor: null
    });

    const governor = items.find((item) => item.moduleKey === "governor");
    expect(governor?.status).toBe("missing");
    expect(governor?.source).toBe("unavailable");
  });

  it("marks treasury vault present when address exists but has no bytecode (EOA)", () => {
    const modules: CommunityModules = {
      treasuryVault: "0x0000000000000000000000000000000000000101"
    };
    const items = buildModuleSummaryItems(modules, {
      treasuryVault: null
    });

    const treasuryVault = items.find((item) => item.moduleKey === "treasuryVault");
    expect(treasuryVault?.status).toBe("present");
    expect(treasuryVault?.address).toBe("0x0000000000000000000000000000000000000101");
    expect(treasuryVault?.source).toBe("EOA treasury vault");
  });

  it("marks treasury vault as contract when bytecode exists", () => {
    const modules: CommunityModules = {
      treasuryVault: "0x0000000000000000000000000000000000000101"
    };
    const items = buildModuleSummaryItems(modules, {
      treasuryVault: "0x1234"
    });

    const treasuryVault = items.find((item) => item.moduleKey === "treasuryVault");
    expect(treasuryVault?.status).toBe("present");
    expect(treasuryVault?.source).toBe("contract treasury vault");
  });
});
