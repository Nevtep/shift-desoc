import { GraphQLClient } from "graphql-request";

export type CreateGraphQLClientOptions = {
  /** GraphQL endpoint URL */
  url: string;
  /** Optional headers */
  headers?: Record<string, string>;
};

export function createGraphQLClient({
  url,
  headers
}: CreateGraphQLClientOptions): GraphQLClient {
  if (!url) {
    throw new Error("GraphQL URL is required");
  }

  return new GraphQLClient(url, {
    headers
  });
}
