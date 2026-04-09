import { describe, expect, it } from "vitest";

import { encodeGuidedTemplateCalldata, listGuidedTemplates } from "../../../../lib/actions/guided-templates";

const FIXTURES: Record<string, Record<string, string>> = {
  "var.setValuableActionSBT": { sbtAddress: "0x0000000000000000000000000000000000001001" },
  "var.setIssuanceModule": {
    moduleAddress: "0x0000000000000000000000000000000000001002",
    enabled: "true"
  },
  "var.addFounder": { founderAddress: "0x0000000000000000000000000000000000001003" },
  "vpt.initializeCommunity": { metadataURI: "ipfs://shift/vpt/community" },
  "vpt.setURI": { uri: "ipfs://shift/vpt/{id}.json" },
  "rr.setCommunityTreasury": { treasury: "0x0000000000000000000000000000000000001004" },
  "rr.setSupportedToken": {
    token: "0x0000000000000000000000000000000000001005",
    enabled: "true"
  },
  "ta.setTokenAllowed": {
    token: "0x0000000000000000000000000000000000001006",
    allowed: "true"
  },
  "ta.setCapBps": {
    token: "0x0000000000000000000000000000000000001007",
    capBps: "1000"
  },
  "ta.setDestinationAllowed": {
    destination: "0x0000000000000000000000000000000000001008",
    allowed: "true"
  },
  "mp.setCommunityActive": { active: "true" },
  "mp.setCommunityToken": { token: "0x0000000000000000000000000000000000001009" },
  "ve.setVerifierSet": {
    verifiers: "0x0000000000000000000000000000000000001010,0x0000000000000000000000000000000000001011",
    powers: "100,200",
    reason: "initial roster"
  },
  "ve.banVerifiers": {
    verifiers: "0x0000000000000000000000000000000000001012",
    reason: "violation"
  },
  "ve.unbanVerifier": {
    verifier: "0x0000000000000000000000000000000000001013",
    reason: "appeal resolved"
  },
  "ve.adjustVerifierPower": {
    verifier: "0x0000000000000000000000000000000000001014",
    newPower: "333",
    reason: "performance update"
  }
};

describe("guided-templates", () => {
  it("encodes each v1 guided template deterministically", () => {
    const templates = listGuidedTemplates();
    const encoded = templates.map((template) => {
      const fixture = FIXTURES[template.id];
      expect(fixture).toBeDefined();
      return {
        id: template.id,
        signature: template.signature,
        calldata: encodeGuidedTemplateCalldata(template, fixture).calldata
      };
    });

    expect(encoded).toMatchSnapshot();
  });

  it("excludes non-governance templates from guided catalog", () => {
    const templateIds = listGuidedTemplates().map((template) => template.id);
    expect(templateIds).not.toContain("requestStatus");
    expect(templateIds).not.toContain("draftContributorAdd");
    expect(templateIds).not.toContain("draftSnapshotVersion");
    expect(templateIds).not.toContain("draftEscalateToProposal");
  });
});
