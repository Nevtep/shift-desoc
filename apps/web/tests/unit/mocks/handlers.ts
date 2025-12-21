import { graphql, http, HttpResponse } from "msw";

import { fixtures } from "./fixtures";

const GRAPHQL_URL = "http://localhost:4000/graphql";
const API_BASE = "http://localhost:4000";

export const handlers = [
  graphql.query("Communities", () => {
    return HttpResponse.json({
      data: {
        communities: {
          nodes: [fixtures.community],
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("Requests", () => {
    return HttpResponse.json({
      data: {
        requests: {
          nodes: [fixtures.request],
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("Request", ({ variables }) => {
    const id = String((variables as { id?: number | string } | undefined)?.id ?? "");
    const match = id === fixtures.request.id ? fixtures.request : null;
    return HttpResponse.json({ data: { request: match } });
  }),
  graphql.query("Drafts", ({ variables }) => {
    const requestId = (variables as { requestId?: number } | undefined)?.requestId;
    const nodes = requestId && String(requestId) !== fixtures.request.id ? [] : [fixtures.draft];
    return HttpResponse.json({
      data: {
        drafts: {
          nodes,
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("CommentsByRequest", () => {
    return HttpResponse.json({
      data: {
        comments: {
          nodes: [],
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("Proposals", () => {
    return HttpResponse.json({
      data: {
        proposals: {
          nodes: [fixtures.proposal],
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("Proposal", ({ variables }) => {
    const id = String((variables as { id?: string } | undefined)?.id ?? "");
    const match = id === fixtures.proposal.id ? fixtures.proposal : null;
    return HttpResponse.json({ data: { proposal: match } });
  }),
  graphql.query("Claims", () => {
    return HttpResponse.json({
      data: {
        claims: {
          nodes: [fixtures.claim],
          pageInfo: { endCursor: null, hasNextPage: false }
        }
      }
    });
  }),
  graphql.query("Claim", ({ variables }) => {
    const id = String((variables as { id?: string } | undefined)?.id ?? "");
    const match = id === fixtures.claim.id ? fixtures.claim : null;
    return HttpResponse.json({ data: { claim: match } });
  }),
  // Draft detail via REST API base
  http.get(`${API_BASE}/drafts/:draftId`, ({ params }) => {
    const draftId = String(params.draftId);
    if (draftId !== fixtures.draft.id) {
      return HttpResponse.json({ draft: null });
    }
    return HttpResponse.json({
      draft: {
        ...fixtures.draft,
        versions: fixtures.draftVersions,
        reviews: fixtures.draftReviews
      }
    });
  }),
  // IPFS proxy for request/draft/proposal/claim documents
  http.get("/api/ipfs/:cid", ({ params }) => {
    const cid = String(params.cid);
    const now = new Date().toISOString();

    if (cid === fixtures.request.cid) {
      return HttpResponse.json({
        cid,
        type: "request",
        version: "1.0",
        data: { type: "request", title: "Request title", createdAt: fixtures.request.createdAt },
        html: { body: "<p>Request body</p>" },
        retrievedAt: now
      });
    }

    if (cid === fixtures.draft.latestVersionCid) {
      return HttpResponse.json({
        cid,
        type: "draftVersion",
        version: "1.0",
        data: { type: "draftVersion", title: "Draft title" },
        html: { body: "<p>Draft content</p>" },
        retrievedAt: now
      });
    }

    if (cid === fixtures.proposal.descriptionCid) {
      return HttpResponse.json({
        cid,
        type: "proposalDescription",
        version: "1.0",
        data: { type: "proposalDescription", title: "Proposal description" },
        html: { body: "<p>Proposal description content</p>" },
        retrievedAt: now
      });
    }

    if (cid === fixtures.claim.evidenceManifestCid) {
      return HttpResponse.json({
        cid,
        type: "claimEvidence",
        version: "1.0",
        data: {
          type: "claimEvidence",
          evidence: [
            {
              title: "Proof",
              description: "Evidence description",
              type: "text",
              cid: "evidence-cid-1"
            }
          ]
        },
        html: { body: "<p>Evidence body</p>" },
        retrievedAt: now
      });
    }

    if (cid === "comment-cid-1") {
      return HttpResponse.json({
        cid,
        type: "comment",
        version: "1.0",
        data: { type: "comment", body: "Comment text" },
        html: { body: "<p>Comment text</p>" },
        retrievedAt: now
      });
    }

    return HttpResponse.json({
      cid,
      type: "unknown",
      version: "1.0",
      data: { type: "unknown" },
      html: { body: "" },
      retrievedAt: now
    });
  }),
  http.post("/api/ipfs/upload", async () => {
    return HttpResponse.json({ cid: "uploaded-cid" });
  })
];

export const graphqlUrl = GRAPHQL_URL;
export const apiBaseUrl = API_BASE;
