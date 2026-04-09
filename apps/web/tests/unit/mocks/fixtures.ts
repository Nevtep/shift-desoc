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
    communityId: 1,
    requestId: "1",
    status: "FINALIZED",
    targets: ["0x0000000000000000000000000000000000000001"],
    values: ["0"],
    calldatas: ["0x"],
    actionsHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
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
  proposals: [
    {
      id: "100",
      communityId: 1,
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
      multiChoiceOptions: ["Option A", "Option B", "Option C"],
      votes: [
        {
          voter: "0xabc1230000000000000000000000000000000000",
          weight: "6000",
          optionIndex: 1,
          castAt: new Date("2024-03-02T00:00:00Z").toISOString()
        },
        {
          voter: "0xabc1230000000000000000000000000000000000",
          weight: "4000",
          optionIndex: 2,
          castAt: new Date("2024-03-02T00:00:00Z").toISOString()
        }
      ]
    },
    {
      id: "101",
      communityId: 1,
      proposer: "0xabc1230000000000000000000000000000000000",
      descriptionCid: "proposal-desc-cid-queued",
      descriptionHash: "0x2234",
      targets: ["0x0000000000000000000000000000000000000000"],
      values: ["0"],
      calldatas: ["0x"],
      state: "Queued",
      createdAt: new Date("2024-03-03T00:00:00Z").toISOString(),
      queuedAt: new Date("2024-03-04T00:00:00Z").toISOString(),
      executedAt: null,
      multiChoiceOptions: ["For", "Against"],
      votes: []
    },
    {
      id: "102",
      communityId: 2,
      proposer: "0xabc1230000000000000000000000000000000000",
      descriptionCid: "proposal-desc-cid-other-community",
      descriptionHash: "0x3234",
      targets: ["0x0000000000000000000000000000000000000000"],
      values: ["0"],
      calldatas: ["0x"],
      state: "Defeated",
      createdAt: new Date("2024-03-05T00:00:00Z").toISOString(),
      queuedAt: null,
      executedAt: null,
      multiChoiceOptions: ["For", "Against"],
      votes: []
    }
  ],
  proposalStates: ["Pending", "Active", "Succeeded", "Defeated", "Queued", "Executed"],
  proposal: null as unknown,
  draftMissingActions: {
    id: "11",
    communityId: 1,
    requestId: "1",
    status: "FINALIZED",
    targets: [],
    values: [],
    calldatas: [],
    actionsHash: null,
    latestVersionCid: "draft-cid-11",
    escalatedProposalId: null,
    updatedAt: new Date("2024-02-12T00:00:00Z").toISOString(),
    createdAt: new Date("2024-02-08T00:00:00Z").toISOString()
  },
  engagement: {
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
  engagementJuror: {
    juror: "0xJUROR000000000000000000000000000000000000",
    weight: "1",
    decision: null,
    decidedAt: null
  },
  deploy: {
    sessionId: "0xabc-1",
    deployerAddress: "0xabc1230000000000000000000000000000000000",
    chainId: 84532,
    communityId: 1,
    status: "in-progress",
    steps: [
      { key: "PRECHECKS", status: "succeeded" },
      { key: "DEPLOY_STACK", status: "running" },
      { key: "CONFIGURE_ACCESS_PERMISSIONS", status: "pending" },
      { key: "HANDOFF_ADMIN_TO_TIMELOCK", status: "pending" },
      { key: "VERIFY_DEPLOYMENT", status: "pending" }
    ]
  }
};

fixtures.proposal = fixtures.proposals[0];
