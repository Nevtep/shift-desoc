export const CommunitiesQuery = /* GraphQL */ `
  query Communities($limit: Int = 20, $after: String) {
    communities: communitiess(orderBy: "createdAt", orderDirection: "desc", after: $after, limit: $limit) {
      nodes: items {
        id
        chainId
        name
        metadataUri
        createdAt
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export type CommunityNode = {
  id: string;
  chainId: number;
  name: string;
  metadataUri?: string | null;
  createdAt: string;
};

export type CommunitiesQueryResult = {
  communities: {
    nodes: CommunityNode[];
    pageInfo: {
      endCursor?: string | null;
      hasNextPage: boolean;
    };
  };
};

export const RequestsQuery = /* GraphQL */ `
  query Requests($communityId: Int, $status: [String!], $limit: Int = 20, $after: String) {
    requests: requestss(
      where: { communityId: $communityId, status_in: $status }
      orderBy: "createdAt"
      orderDirection: "desc"
      after: $after
      limit: $limit
    ) {
      nodes: items {
        id
        communityId
        author
        status
        cid
        tags
        createdAt
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export type RequestNode = {
  id: string;
  communityId: string;
  author: string;
  status: string;
  cid: string;
  tags: string[];
  createdAt: string;
};

export type RequestsQueryResult = {
  requests: {
    nodes: RequestNode[];
    pageInfo: {
      endCursor?: string | null;
      hasNextPage: boolean;
    };
  };
};

export const RequestQuery = /* GraphQL */ `
  query Request($id: Int!) {
    request: requests(id: $id) {
      id
      communityId
      author
      status
      cid
      tags
      createdAt
    }
  }
`;

export type RequestQueryResult = {
  request: {
    id: string;
    communityId: string;
    author: string;
    status: string;
    cid: string;
    tags: string[];
    createdAt: string;
  } | null;
};

export const DraftQuery = /* GraphQL */ `
  query Draft($id: Int!) {
    draft: drafts(id: $id) {
      id
      requestId
      status
      latestVersionCid
      escalatedProposalId
      updatedAt
      createdAt
    }
  }
`;

export type DraftQueryResult = {
  draft: {
    id: string;
    requestId: string;
    status: string;
    latestVersionCid?: string | null;
    escalatedProposalId?: string | null;
    updatedAt: string;
    createdAt: string;
  } | null;
};

export const DraftsQuery = /* GraphQL */ `
  query Drafts($communityId: Int, $status: [String!], $limit: Int = 20, $after: String) {
    drafts: draftss(
      where: { communityId: $communityId, status_in: $status }
      orderBy: "updatedAt"
      orderDirection: "desc"
      after: $after
      limit: $limit
    ) {
      nodes: items {
        id
        requestId
        status
        latestVersionCid
        escalatedProposalId
        updatedAt
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export type DraftNode = {
  id: string;
  requestId: string;
  status: string;
  latestVersionCid?: string | null;
  escalatedProposalId?: string | null;
  updatedAt: string;
};

export type DraftsQueryResult = {
  drafts: {
    nodes: DraftNode[];
    pageInfo: {
      endCursor?: string | null;
      hasNextPage: boolean;
    };
  };
};

export const ProposalQuery = /* GraphQL */ `
  query Proposal($id: String!) {
    proposal: proposals(id: $id) {
      id
      communityId
      proposer
      descriptionCid
      descriptionHash
      targets
      values
      calldatas
      state
      createdAt
      queuedAt
      executedAt
      multiChoiceOptions
      votes {
        voter
        weight
        optionIndex
        castAt
      }
    }
  }
`;

export type ProposalQueryResult = {
  proposal: {
    id: string;
    communityId: number;
    proposer: string;
    descriptionCid?: string | null;
    descriptionHash?: string | null;
    targets?: string[] | null;
    values?: string[] | null;
    calldatas?: string[] | null;
    state: string;
    createdAt: string;
    queuedAt?: string | null;
    executedAt?: string | null;
    multiChoiceOptions?: string[] | null;
    votes?: {
      voter: string;
      weight: string;
      optionIndex?: number | null;
      castAt: string;
    }[];
  } | null;
};

export const ProposalsQuery = /* GraphQL */ `
  query Proposals($communityId: Int, $state: [String!], $limit: Int = 20, $after: String) {
    proposals: proposalss(
      where: { communityId: $communityId, state_in: $state }
      orderBy: "createdAt"
      orderDirection: "desc"
      after: $after
      limit: $limit
    ) {
      nodes: items {
        id
        communityId
        proposer
        state
        createdAt
        queuedAt
        executedAt
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export type ProposalNode = {
  id: string;
  communityId: number;
  proposer: string;
  state: string;
  createdAt: string;
  queuedAt?: string | null;
  executedAt?: string | null;
};

export type ProposalsQueryResult = {
  proposals: {
    nodes: ProposalNode[];
    pageInfo: {
      endCursor?: string | null;
      hasNextPage: boolean;
    };
  };
};

export const ClaimsQuery = /* GraphQL */ `
  query Claims($communityId: Int, $status: [String!], $limit: Int = 20, $after: String) {
    claims: claimss(
      where: { communityId: $communityId, status_in: $status }
      orderBy: "submittedAt"
      orderDirection: "desc"
      after: $after
      limit: $limit
    ) {
      nodes: items {
        id
        communityId
        valuableActionId
        claimant
        status
        evidenceManifestCid
        submittedAt
        resolvedAt
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export type ClaimNode = {
  communityId: number;
  id: string;
  valuableActionId: string;
  claimant: string;
  status: string;
  evidenceManifestCid?: string | null;
  submittedAt: string;
  resolvedAt?: string | null;
};

export type ClaimsQueryResult = {
  claims: {
    nodes: ClaimNode[];
    pageInfo: {
      endCursor?: string | null;
      hasNextPage: boolean;
    };
  };
};

export const ClaimQuery = /* GraphQL */ `
  query Claim($id: Int!) {
    claim: claims(id: $id) {
      id
      communityId
      valuableActionId
      claimant
      status
      evidenceManifestCid
      submittedAt
      resolvedAt
      jurorAssignments {
        juror
        weight
        decision
        decidedAt
      }
    }
  }
`;

export type ClaimQueryResult = {
  claim: {
    communityId: number;
    id: string;
    valuableActionId: string;
    claimant: string;
    status: string;
    evidenceManifestCid?: string | null;
    submittedAt: string;
    resolvedAt?: string | null;
    jurorAssignments?: {
      juror: string;
      weight: string;
      decision?: string | null;
      decidedAt?: string | null;
    }[];
  } | null;
};
