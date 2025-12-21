export const fixtures = {
  community: {
    id: "1",
    chainId: 84532,
    name: "Alpha",
    metadataUri: "ipfs://alpha",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString()
  },
  request: {
    id: "1",
    communityId: "1",
    author: "0xabc1230000000000000000000000000000000000",
    status: "OPEN",
    cid: "request-cid-1",
    tags: ["core"],
    createdAt: new Date("2024-02-01T00:00:00Z").toISOString()
  },
  draft: {
    id: "10",
    requestId: "1",
    status: "FINALIZED",
    latestVersionCid: "draft-cid-10",
    escalatedProposalId: "100",
    updatedAt: new Date("2024-02-10T00:00:00Z").toISOString(),
    createdAt: new Date("2024-02-05T00:00:00Z").toISOString()
  },
  draftVersions: [
    {
      id: "v1",
      cid: "draft-cid-10",
      contributor: "0xabc1230000000000000000000000000000000000",
      createdAt: new Date("2024-02-05T00:00:00Z").toISOString()
    }
  ],
  draftReviews: [
    {
      id: "r1",
      reviewer: "0xdef4560000000000000000000000000000000000",
      stance: "approve",
      commentCid: "comment-cid-1",
      createdAt: new Date("2024-02-06T00:00:00Z").toISOString()
    }
  ],
  proposal: {
    id: "100",
    communityId: 84532,
    proposer: "0xabc1230000000000000000000000000000000000",
    descriptionCid: "proposal-desc-cid",
    descriptionHash: "0x1234",
    targets: ["0x0000000000000000000000000000000000000000"],
    values: ["0"],
    calldatas: ["0x"],
    state: "Active",
    createdAt: new Date("2024-03-01T00:00:00Z").toISOString(),
    queuedAt: null,
    executedAt: null,
    multiChoiceOptions: ["Option A", "Option B"],
    votes: [
      {
        voter: "0xabc1230000000000000000000000000000000000",
        weight: "1000000000000000000",
        optionIndex: 1,
        castAt: new Date("2024-03-02T00:00:00Z").toISOString()
      }
    ]
  },
  claim: {
    communityId: 84532,
    id: "50",
    valuableActionId: "200",
    claimant: "0xabc1230000000000000000000000000000000000",
    status: "Pending",
    evidenceManifestCid: "claim-manifest-cid",
    submittedAt: new Date("2024-04-01T00:00:00Z").toISOString(),
    resolvedAt: null,
    jurorAssignments: [
      {
        juror: "0xJUROR000000000000000000000000000000000000",
        weight: "1",
        decision: null,
        decidedAt: null
      }
    ]
  },
  claimJuror: {
    juror: "0xJUROR000000000000000000000000000000000000",
    weight: "1",
    decision: null,
    decidedAt: null
  }
};
