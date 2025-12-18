export const CommunitiesQuery = /* GraphQL */ `
  query Communities($first: Int = 20, $after: String) {
    communities(first: $first, after: $after) {
      nodes {
        id
        chainId
        name
        metadataUri
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
  query Requests($communityId: ID, $status: [RequestStatus!], $first: Int = 20, $after: String) {
    requests(communityId: $communityId, status: $status, first: $first, after: $after) {
      nodes {
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
  query Request($id: ID!) {
    request(id: $id) {
      id
      communityId
      author
      status
      cid
      tags
      createdAt
      comments {
        id
        author
        cid
        createdAt
        parentId
      }
      drafts {
        id
        status
        latestVersionCid
      }
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
    comments: Array<{
      id: string;
      author: string;
      cid: string;
      createdAt: string;
      parentId?: string | null;
    }>;
    drafts: Array<{
      id: string;
      status: string;
      latestVersionCid?: string | null;
    }>;
  } | null;
};

export const DraftQuery = /* GraphQL */ `
  query Draft($id: ID!) {
    draft(id: $id) {
      id
      requestId
      status
      latestVersionCid
      escalatedProposalId
      versions {
        id
        cid
        contributor
        createdAt
      }
      reviews {
        id
        reviewer
        stance
        commentCid
        createdAt
      }
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
    versions: Array<{
      id: string;
      cid: string;
      contributor: string;
      createdAt: string;
    }>;
    reviews: Array<{
      id: string;
      reviewer: string;
      stance: string;
      commentCid?: string | null;
      createdAt: string;
    }>;
  } | null;
};

export const DraftsQuery = /* GraphQL */ `
  query Drafts($communityId: ID, $status: [DraftStatus!], $first: Int = 20, $after: String) {
    drafts(communityId: $communityId, status: $status, first: $first, after: $after) {
      nodes {
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
  query Proposal($id: ID!) {
    proposal(id: $id) {
      id
      communityId
      proposer
      descriptionCid
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
    communityId: string;
    proposer: string;
    descriptionCid?: string | null;
    state: string;
    createdAt: string;
    queuedAt?: string | null;
    executedAt?: string | null;
    multiChoiceOptions?: string[] | null;
    votes: Array<{
      voter: string;
      weight: string;
      optionIndex?: number | null;
      castAt: string;
    }>;
  } | null;
};

export const ProposalsQuery = /* GraphQL */ `
  query Proposals($communityId: ID, $state: [ProposalState!], $first: Int = 20, $after: String) {
    proposals(communityId: $communityId, state: $state, first: $first, after: $after) {
      nodes {
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
  communityId: string;
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
  query Claims($communityId: ID, $status: [ClaimStatus!], $first: Int = 20, $after: String) {
    claims(communityId: $communityId, status: $status, first: $first, after: $after) {
      nodes {
        id
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
  query Claim($id: ID!) {
    claim(id: $id) {
      id
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
    id: string;
    valuableActionId: string;
    claimant: string;
    status: string;
    evidenceManifestCid?: string | null;
    submittedAt: string;
    resolvedAt?: string | null;
    jurorAssignments: Array<{
      juror: string;
      weight: string;
      decision?: string | null;
      decidedAt?: string | null;
    }>;
  } | null;
};
