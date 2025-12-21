import { onchainSchema } from "@ponder/core";

// Onchain schema for the Shift indexer. All tables are prefixed by the Ponder instance id automatically.
export const schema = onchainSchema("shift");

export const communities = schema.table("communities", (t) => ({
  id: t.integer().primaryKey(),
  chainId: t.integer().notNull(),
  name: t.text().notNull(),
  metadataUri: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const requests = schema.table("requests", (t) => ({
  id: t.integer().primaryKey(),
  communityId: t.integer().notNull(),
  author: t.text().notNull(),
  status: t.text().notNull(),
  cid: t.text().notNull(),
  tags: t.jsonb().$type<string[]>().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const comments = schema.table("comments", (t) => ({
  id: t.integer().primaryKey(),
  requestId: t.integer().notNull(),
  author: t.text().notNull(),
  cid: t.text().notNull(),
  parentId: t.integer(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
  isModerated: t.boolean().notNull(),
}));

export const drafts = schema.table("drafts", (t) => ({
  id: t.integer().primaryKey(),
  communityId: t.integer().notNull(),
  requestId: t.integer().notNull(),
  status: t.text().notNull(),
  latestVersionCid: t.text(),
  escalatedProposalId: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const draftVersions = schema.table("draft_versions", (t) => ({
  id: t.text().primaryKey(),
  draftId: t.integer().notNull(),
  versionNumber: t.integer().notNull(),
  cid: t.text().notNull(),
  contributor: t.text().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const draftReviews = schema.table("draft_reviews", (t) => ({
  id: t.text().primaryKey(),
  draftId: t.integer().notNull(),
  reviewer: t.text().notNull(),
  stance: t.text().notNull(),
  commentCid: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const proposals = schema.table("proposals", (t) => ({
  id: t.text().primaryKey(),
  communityId: t.integer().notNull(),
  proposer: t.text().notNull(),
  descriptionCid: t.text(),
  descriptionHash: t.text(),
  targets: t.jsonb().$type<string[]>().notNull(),
  values: t.jsonb().$type<string[]>().notNull(),
  calldatas: t.jsonb().$type<string[]>().notNull(),
  state: t.text().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).notNull(),
  queuedAt: t.timestamp({ withTimezone: true }),
  executedAt: t.timestamp({ withTimezone: true }),
  multiChoiceOptions: t.jsonb().$type<number[] | null>(),
}));

export const proposalVotes = schema.table("proposal_votes", (t) => ({
  id: t.text().primaryKey(),
  proposalId: t.text().notNull(),
  voter: t.text().notNull(),
  weight: t.bigint().notNull(),
  optionIndex: t.integer(),
  castAt: t.timestamp({ withTimezone: true }).notNull(),
}));

export const claims = schema.table("claims", (t) => ({
  id: t.integer().primaryKey(),
  communityId: t.integer().notNull(),
  valuableActionId: t.integer().notNull(),
  claimant: t.text().notNull(),
  status: t.text().notNull(),
  evidenceManifestCid: t.text(),
  submittedAt: t.timestamp({ withTimezone: true }).notNull(),
  resolvedAt: t.timestamp({ withTimezone: true }),
}));

export const jurorAssignments = schema.table("juror_assignments", (t) => ({
  id: t.text().primaryKey(),
  claimId: t.integer().notNull(),
  juror: t.text().notNull(),
  weight: t.bigint(),
  decision: t.text(),
  decidedAt: t.timestamp({ withTimezone: true }),
}));

export const schemaTables = {
  communities,
  requests,
  comments,
  drafts,
  draftVersions,
  draftReviews,
  proposals,
  proposalVotes,
  claims,
  jurorAssignments,
};

export default schemaTables;
