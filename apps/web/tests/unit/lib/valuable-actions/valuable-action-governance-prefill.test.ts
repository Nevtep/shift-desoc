import { describe, expect, it } from "vitest";

import {
  buildValuableActionCreateDraftKey,
  buildValuableActionEditDraftKey,
  buildValuableActionProposalHref,
} from "../../../../lib/valuable-actions/governance";

describe("valuable action governance prefill helpers", () => {
  it("builds an edit proposal href carrying the action id", () => {
    const href = buildValuableActionProposalHref({
      communityId: 7,
      operation: "edit",
      actionId: 42,
    });

    expect(href).toContain("/communities/7/governance/proposals/new?");
    expect(href).toContain("template=valuable_action");
    expect(href).toContain("operation=edit");
    expect(href).toContain("actionId=42");
  });

  it("keeps create, activate, and deactivate hrefs stable", () => {
    expect(
      buildValuableActionProposalHref({ communityId: 3, operation: "create" })
    ).toContain("operation=create");
    expect(
      buildValuableActionProposalHref({ communityId: 3, operation: "activate", actionId: 5, nextActive: true })
    ).toContain("operation=activate");
    expect(
      buildValuableActionProposalHref({ communityId: 3, operation: "deactivate", actionId: 5, nextActive: false })
    ).toContain("operation=deactivate");
  });

  it("scopes governance prefill drafts per community and per edited action", () => {
    expect(buildValuableActionCreateDraftKey(9)).toBe("va-proposal-draft:9");
    expect(buildValuableActionEditDraftKey(9, 4)).toBe("va-proposal-draft:9:edit:4");
    expect(buildValuableActionEditDraftKey(9, 4)).not.toBe(buildValuableActionEditDraftKey(9, 5));
    expect(buildValuableActionEditDraftKey(9, 4)).not.toBe(buildValuableActionCreateDraftKey(9));
  });
});
