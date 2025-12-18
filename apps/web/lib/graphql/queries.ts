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
