import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readAbi = (name: string) => {
  const filePath = path.join(process.cwd(), "abis", `${name}.json`);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return parsed.abi as Array<{ type?: string; name?: string }>;
};

test("abi-event-compatibility: ensures handler-referenced events exist in configured ABIs", () => {
    const checks: Record<string, string[]> = {
      CommunityRegistry: [
        "CommunityRegistered",
        "CommunityMetadataURIUpdated",
        "CommunityParentUpdated",
        "ModuleAddressUpdated",
      ],
      RequestHub: ["RequestCreated", "CommentPosted", "RequestStatusChanged", "CommentModerated"],
      DraftsManager: [
        "DraftCreated",
        "VersionSnapshot",
        "ReviewSubmitted",
        "ReviewRetracted",
        "DraftStatusChanged",
        "ProposalEscalated",
        "ProposalOutcomeUpdated",
      ],
      ShiftGovernor: ["ProposalCreated", "MultiChoiceProposalCreated", "ProposalQueued", "ProposalExecuted", "VoteCast"],
      CountingMultiChoice: ["MultiChoiceEnabled", "ProposalCanceled", "VoteCastMulti"],
      Engagements: ["EngagementSubmitted", "JurorsAssigned", "EngagementVerified", "EngagementResolved", "EngagementRevoked"],
      VerifierManager: ["JurorsSelected"],
      ValuableActionRegistry: [
        "ValuableActionCreated",
        "ValuableActionUpdated",
        "ValuableActionActivated",
        "ValuableActionDeactivated",
      ],
    };

    for (const [contract, events] of Object.entries(checks)) {
      const abi = readAbi(contract);
      const eventNames = new Set(abi.filter((x) => x.type === "event").map((x) => x.name));
      for (const eventName of events) {
        expect(eventNames.has(eventName)).toBe(true);
      }
    }
});
