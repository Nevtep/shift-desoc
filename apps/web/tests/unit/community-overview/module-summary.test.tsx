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
});
