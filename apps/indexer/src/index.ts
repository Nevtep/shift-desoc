import fs from "node:fs";
import path from "node:path";

import { and, desc, eq, graphql } from "@ponder/core";
import {
  engagements,
  comments,
  communities,
  draftReviews,
  draftVersions,
  drafts,
  jurorAssignments,
  proposalVotes,
  proposals,
  requests,
} from "../ponder.schema";

import { keccak256, toBytes, type Address } from "viem";
import { ponder } from "@/generated";

// --- API ROUTES (Hono via Ponder) -------------------------------------------------

// Expose GraphQL endpoint for the web app and tooling.
ponder.use("/graphql", graphql());

ponder.get("/api/health", (c) => c.json({ ok: true }));

ponder.get("/communities", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));

  const rows = await c.db
    .select()
    .from(communities)
    .orderBy(desc(communities.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, nextOffset: offset + rows.length });
});

ponder.get("/requests", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
  const communityId = toNumberOrNull(c.req.query("communityId"));

  const rows = await c.db
    .select()
    .from(requests)
    .where(combineAnd([communityId ? eq(requests.communityId, communityId) : undefined]))
    .orderBy(desc(requests.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, nextOffset: offset + rows.length });
});

ponder.get("/requests/:id", async (c) => {
  const requestId = Number(c.req.param("id"));
  if (!Number.isFinite(requestId)) return c.json({ error: "invalid request id" }, 400);

  const request = await c.db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (request.length === 0) return c.json({ error: "not found" }, 404);

  const commentsForRequest = await c.db
    .select()
    .from(comments)
    .where(eq(comments.requestId, requestId))
    .orderBy(desc(comments.createdAt));

  const draftsForRequest = await c.db
    .select()
    .from(drafts)
    .where(eq(drafts.requestId, requestId))
    .orderBy(desc(drafts.updatedAt));

  return c.json({ request: { ...request[0], comments: commentsForRequest, drafts: draftsForRequest } });
});

ponder.get("/drafts", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
  const communityId = toNumberOrNull(c.req.query("communityId"));
  const requestId = toNumberOrNull(c.req.query("requestId"));

  const rows = await c.db
    .select()
    .from(drafts)
    .where(
      combineAnd([
        communityId ? eq(drafts.communityId, communityId) : undefined,
        requestId ? eq(drafts.requestId, requestId) : undefined,
      ])
    )
    .orderBy(desc(drafts.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, nextOffset: offset + rows.length });
});

ponder.get("/drafts/:id", async (c) => {
  const draftId = Number(c.req.param("id"));
  if (!Number.isFinite(draftId)) return c.json({ error: "invalid draft id" }, 400);

  const draft = await c.db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
  if (draft.length === 0) return c.json({ error: "not found" }, 404);

  const versions = await c.db
    .select()
    .from(draftVersions)
    .where(eq(draftVersions.draftId, draftId))
    .orderBy(desc(draftVersions.versionNumber));

  const reviews = await c.db
    .select()
    .from(draftReviews)
    .where(eq(draftReviews.draftId, draftId))
    .orderBy(desc(draftReviews.createdAt));

  return c.json({ draft: draft[0], versions, reviews });
});

ponder.get("/proposals", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
  const communityId = toNumberOrNull(c.req.query("communityId"));

  const rows = await c.db
    .select()
    .from(proposals)
    .where(combineAnd([communityId ? eq(proposals.communityId, communityId) : undefined]))
    .orderBy(desc(proposals.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, nextOffset: offset + rows.length });
});

ponder.get("/proposals/:id", async (c) => {
  const id = c.req.param("id");
  const proposal = await c.db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (proposal.length === 0) return c.json({ error: "not found" }, 404);

  const votes = await c.db
    .select()
    .from(proposalVotes)
    .where(eq(proposalVotes.proposalId, id))
    .orderBy(desc(proposalVotes.castAt));

  return c.json({ proposal: proposal[0], votes });
});

ponder.get("/engagements", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
  const communityId = toNumberOrNull(c.req.query("communityId"));

  const rows = await c.db
    .select()
    .from(engagements)
    .where(combineAnd([communityId ? eq(engagements.communityId, communityId) : undefined]))
    .orderBy(desc(engagements.submittedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, nextOffset: offset + rows.length });
});

ponder.get("/engagements/:id", async (c) => {
  const engagementId = Number(c.req.param("id"));
  if (!Number.isFinite(engagementId)) return c.json({ error: "invalid engagement id" }, 400);

  const engagement = await c.db.select().from(engagements).where(eq(engagements.id, engagementId)).limit(1);
  if (engagement.length === 0) return c.json({ error: "not found" }, 404);

  const jurors = await c.db
    .select()
    .from(jurorAssignments)
    .where(eq(jurorAssignments.engagementId, engagementId))
    .orderBy(desc(jurorAssignments.weight));

  return c.json({ engagement: engagement[0], jurors });
});

// --- EVENT HANDLERS -------------------------------------------------------------

const network = (process.env.PONDER_NETWORK ?? "base_sepolia") as
  | "base"
  | "base_sepolia";
const deploymentPath = path.join(__dirname, "../../deployments", `${network}.json`);
const deployment = fs.existsSync(deploymentPath)
  ? (JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as { communityId?: number })
  : {};
const defaultCommunityId = deployment.communityId ?? 0;

const requestStatuses = ["OPEN_DEBATE", "FROZEN", "ARCHIVED"] as const;
const draftStatuses = ["DRAFTING", "REVIEW", "FINALIZED", "ESCALATED", "WON", "LOST"] as const;
const reviewTypes = ["SUPPORT", "OPPOSE", "NEUTRAL", "REQUEST_CHANGES"] as const;
const engagementStatuses = ["PENDING", "APPROVED", "REJECTED", "REVOKED"] as const;

const toDate = (timestamp: bigint) => new Date(Number(timestamp) * 1000);
const toNumberOrNull = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type Filter = ReturnType<typeof eq> | undefined;

const combineAnd = (filters: Filter[]) => {
  const present = filters.filter(Boolean) as Exclude<Filter, undefined>[];
  if (present.length === 0) return undefined;
  let acc = present[0]!;
  for (let i = 1; i < present.length; i += 1) {
    acc = and(acc, present[i]!);
  }
  return acc;
};

const parsePagination = (limitRaw: string | null, offsetRaw: string | null) => {
  const limit = Math.min(Math.max(toNumberOrNull(limitRaw) ?? 20, 1), 100);
  const offset = Math.max(toNumberOrNull(offsetRaw) ?? 0, 0);
  return { limit, offset };
};

const buildDraftVersionId = (draftId: number, versionNumber: number) => `${draftId}-${versionNumber}`;
const buildReviewId = (draftId: number, reviewer: Address) => `${draftId}-${reviewer.toLowerCase()}`;
const buildVoteId = (proposalId: bigint, voter: Address) => `${proposalId.toString()}-${voter.toLowerCase()}`;
const buildJurorAssignmentId = (engagementId: number, juror: Address) => `${engagementId}-${juror.toLowerCase()}`;

ponder.on("CommunityRegistry:CommunityRegistered", async ({ event, context }) => {
  const createdAt = toDate(event.block.timestamp);

  await context.db
    .insert(communities)
    .values({
      id: Number(event.args.communityId),
      chainId: context.network.chainId,
      name: event.args.name,
      metadataUri: null,
      createdAt,
    })
    .onConflictDoUpdate({
      target: communities.id,
      set: { chainId: context.network.chainId, name: event.args.name, metadataUri: null, createdAt },
    });
});

ponder.on("RequestHub:RequestCreated", async ({ event, context }) => {
  await context.db
    .insert(requests)
    .values({
      id: Number(event.args.requestId),
      communityId: Number(event.args.communityId),
      author: event.args.author,
      status: requestStatuses[0],
      cid: event.args.cid,
      tags: event.args.tags,
      createdAt: toDate(event.block.timestamp),
    })
    .onConflictDoNothing();
});

ponder.on("RequestHub:CommentPosted", async ({ event, context }) => {
  await context.db
    .insert(comments)
    .values({
      id: Number(event.args.commentId),
      requestId: Number(event.args.requestId),
      author: event.args.author,
      cid: event.args.cid,
      parentId: Number(event.args.parentCommentId) === 0 ? null : Number(event.args.parentCommentId),
      createdAt: toDate(event.block.timestamp),
      isModerated: false,
    })
    .onConflictDoNothing();
});

ponder.on("RequestHub:RequestStatusChanged", async ({ event, context }) => {
  const statusIndex = Number(event.args.newStatus);
  await context.db
    .update(requests, { id: Number(event.args.requestId) })
    .set({ status: requestStatuses[statusIndex] ?? requestStatuses[0] });
});

ponder.on("RequestHub:CommentModerated", async ({ event, context }) => {
  await context.db
    .update(comments, { id: Number(event.args.commentId) })
    .set({ isModerated: event.args.hidden });
});

ponder.on("DraftsManager:DraftCreated", async ({ event, context }) => {
  const now = toDate(event.block.timestamp);
  const draftId = Number(event.args.draftId);

  await context.db
    .insert(drafts)
    .values({
      id: draftId,
      communityId: Number(event.args.communityId),
      requestId: Number(event.args.requestId),
      status: draftStatuses[0],
      latestVersionCid: event.args.versionCID,
      escalatedProposalId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: drafts.id,
      set: {
        communityId: Number(event.args.communityId),
        requestId: Number(event.args.requestId),
        status: draftStatuses[0],
        latestVersionCid: event.args.versionCID,
        updatedAt: now,
      },
    });

  await context.db
    .insert(draftVersions)
    .values({
      id: buildDraftVersionId(draftId, 0),
      draftId,
      versionNumber: 0,
      cid: event.args.versionCID,
      contributor: event.args.author,
      createdAt: now,
    })
    .onConflictDoNothing();
});

ponder.on("DraftsManager:VersionSnapshot", async ({ event, context }) => {
  const draftId = Number(event.args.draftId);
  const versionNumber = Number(event.args.versionNumber);
  const createdAt = toDate(event.block.timestamp);

  await context.db
    .insert(draftVersions)
    .values({
      id: buildDraftVersionId(draftId, versionNumber),
      draftId,
      versionNumber,
      cid: event.args.versionCID,
      contributor: event.args.contributor,
      createdAt,
    })
    .onConflictDoUpdate({
      target: draftVersions.id,
      set: { cid: event.args.versionCID, contributor: event.args.contributor, createdAt },
    });

  await context.db
    .update(drafts, { id: draftId })
    .set({ latestVersionCid: event.args.versionCID, updatedAt: createdAt });
});

ponder.on("DraftsManager:ReviewSubmitted", async ({ event, context }) => {
  const draftId = Number(event.args.draftId);
  const createdAt = toDate(event.block.timestamp);
  const stance = reviewTypes[Number(event.args.reviewType)] ?? reviewTypes[0];

  await context.db
    .insert(draftReviews)
    .values({
      id: buildReviewId(draftId, event.args.reviewer),
      draftId,
      reviewer: event.args.reviewer,
      stance,
      commentCid: event.args.reasonCID,
      createdAt,
    })
    .onConflictDoUpdate({
      target: draftReviews.id,
      set: { stance, commentCid: event.args.reasonCID, createdAt },
    });
});

ponder.on("DraftsManager:ReviewRetracted", async ({ event, context }) => {
  const draftId = Number(event.args.draftId);
  await context.db
    .delete(draftReviews)
    .where(eq(draftReviews.id, buildReviewId(draftId, event.args.reviewer)));
});

ponder.on("DraftsManager:DraftStatusChanged", async ({ event, context }) => {
  const draftId = Number(event.args.draftId);
  const status = draftStatuses[Number(event.args.newStatus)] ?? draftStatuses[0];
  const updatedAt = toDate(event.block.timestamp);

  await context.db
    .update(drafts, { id: draftId })
    .set({ status, updatedAt });
});

ponder.on("DraftsManager:ProposalEscalated", async ({ event, context }) => {
  const draftId = Number(event.args.draftId);
  const proposalId = event.args.proposalId;
  const createdAt = toDate(event.block.timestamp);
  const multiChoiceOptions = event.args.isMultiChoice
    ? Array.from({ length: Number(event.args.numOptions) }, (_, i) => i)
    : null;

  await context.db
    .update(drafts, { id: draftId })
    .set({ escalatedProposalId: proposalId.toString(), status: draftStatuses[3], updatedAt: createdAt });

  await context.db
    .insert(proposals)
    .values({
      id: proposalId.toString(),
      communityId: defaultCommunityId,
      proposer: event.transaction.from,
      descriptionCid: null,
      descriptionHash: null,
      targets: [],
      values: [],
      calldatas: [],
      state: "Active",
      createdAt,
      queuedAt: null,
      executedAt: null,
      multiChoiceOptions,
    })
    .onConflictDoUpdate({
      target: proposals.id,
      set: { multiChoiceOptions, state: "Active", createdAt },
    });
});

ponder.on("DraftsManager:ProposalOutcomeUpdated", async ({ event, context }) => {
  const proposalId = event.args.proposalId.toString();
  const outcome = draftStatuses[Number(event.args.outcome)] ?? draftStatuses[5];
  const updatedAt = toDate(event.block.timestamp);

  await context.db
    .update(drafts, { id: Number(event.args.draftId) })
    .set({ status: outcome, updatedAt });

  await context.db
    .update(proposals, { id: proposalId })
    .set({ state: outcome });
});

ponder.on("ShiftGovernor:ProposalCreated", async ({ event, context }) => {
  const createdAt = toDate(event.block.timestamp);
  const description = event.args.description;
  const descriptionHash = keccak256(toBytes(description));

  await context.db
    .insert(proposals)
    .values({
      id: event.args.proposalId.toString(),
      communityId: defaultCommunityId,
      proposer: event.args.proposer,
      descriptionCid: description,
      descriptionHash,
      targets: event.args.targets,
      values: event.args.values.map((val) => val.toString()),
      calldatas: event.args.calldatas,
      state: "Active",
      createdAt,
      queuedAt: null,
      executedAt: null,
      multiChoiceOptions: null,
    })
    .onConflictDoUpdate({
      target: proposals.id,
      set: {
        proposer: event.args.proposer,
        descriptionCid: description,
        descriptionHash,
        targets: event.args.targets,
        values: event.args.values.map((val) => val.toString()),
        calldatas: event.args.calldatas,
        state: "Active",
        createdAt,
      },
    });
});

ponder.on("ShiftGovernor:MultiChoiceProposalCreated", async ({ event, context }) => {
  const createdAt = toDate(event.block.timestamp);
  const descriptionHash = keccak256(toBytes(event.args.description));
  const options = Array.from({ length: Number(event.args.numOptions) }, (_, i) => i);

  await context.db
    .insert(proposals)
    .values({
      id: event.args.proposalId.toString(),
      communityId: defaultCommunityId,
      proposer: event.args.proposer,
      descriptionCid: event.args.description,
      descriptionHash,
      targets: event.args.targets,
      values: event.args.values.map((val) => val.toString()),
      calldatas: event.args.calldatas,
      state: "Active",
      createdAt,
      queuedAt: null,
      executedAt: null,
      multiChoiceOptions: options,
    })
    .onConflictDoUpdate({
      target: proposals.id,
      set: {
        proposer: event.args.proposer,
        descriptionCid: event.args.description,
        descriptionHash,
        targets: event.args.targets,
        values: event.args.values.map((val) => val.toString()),
        calldatas: event.args.calldatas,
        state: "Active",
        multiChoiceOptions: options,
      },
    });
});

ponder.on("CountingMultiChoice:MultiChoiceEnabled", async ({ event, context }) => {
  const options = Array.from({ length: Number(event.args.options) }, (_, i) => i);
  await context.db
    .update(proposals, { id: event.args.proposalId.toString() })
    .set({ multiChoiceOptions: options });
});

ponder.on("ShiftGovernor:ProposalQueued", async ({ event, context }) => {
  const queuedAt = toDate(event.block.timestamp);
  await context.db
    .update(proposals, { id: event.args.proposalId.toString() })
    .set({ state: "Queued", queuedAt });
});

ponder.on("ShiftGovernor:ProposalExecuted", async ({ event, context }) => {
  const executedAt = toDate(event.block.timestamp);
  await context.db
    .update(proposals, { id: event.args.proposalId.toString() })
    .set({ state: "Executed", executedAt });
});

ponder.on("CountingMultiChoice:ProposalCanceled", async ({ event, context }) => {
  await context.db
    .update(proposals, { id: event.args.proposalId.toString() })
    .set({ state: "Canceled" });
});

ponder.on("ShiftGovernor:VoteCast", async ({ event, context }) => {
  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.weight,
      optionIndex: Number(event.args.support),
      castAt,
    })
    .onConflictDoUpdate({
      target: proposalVotes.id,
      set: { weight: event.args.weight, optionIndex: Number(event.args.support), castAt },
    });
});

ponder.on("CountingMultiChoice:VoteCastMulti", async ({ event, context }) => {
  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.totalWeight,
      optionIndex: null,
      castAt,
    })
    .onConflictDoUpdate({
      target: proposalVotes.id,
      set: { weight: event.args.totalWeight, optionIndex: null, castAt },
    });
});

ponder.on("ShiftGovernor:MultiChoiceVoteCast", async ({ event, context }) => {
  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.totalWeight,
      optionIndex: null,
      castAt,
    })
    .onConflictDoUpdate({
      target: proposalVotes.id,
      set: { weight: event.args.totalWeight, optionIndex: null, castAt },
    });
});

ponder.on("Engagements:EngagementSubmitted", async ({ event, context }) => {
  const submittedAt = toDate(event.block.timestamp);
  await context.db
    .insert(engagements)
    .values({
      id: Number(event.args.engagementId),
      communityId: defaultCommunityId,
      valuableActionId: Number(event.args.typeId),
      participant: event.args.participant,
      status: engagementStatuses[0],
      evidenceManifestCid: event.args.evidenceCID,
      submittedAt,
      resolvedAt: null,
    })
    .onConflictDoUpdate({
      target: engagements.id,
      set: {
        communityId: defaultCommunityId,
        valuableActionId: Number(event.args.typeId),
        participant: event.args.participant,
        status: engagementStatuses[0],
        evidenceManifestCid: event.args.evidenceCID,
        submittedAt,
        resolvedAt: null,
      },
    });
});

ponder.on("VerifierManager:JurorsSelected", async ({ event, context }) => {
  const engagementId = Number(event.args.engagementId);
  const jurors = event.args.jurors as Address[];
  const powers = event.args.powers as bigint[];

  await context.db
    .update(engagements, { id: engagementId })
    .set({ communityId: Number(event.args.communityId) });

  for (let i = 0; i < jurors.length; i += 1) {
    const juror = jurors[i]!;
    await context.db
      .insert(jurorAssignments)
      .values({
        id: buildJurorAssignmentId(engagementId, juror),
        engagementId,
        juror,
        weight: powers[i],
        decision: null,
        decidedAt: null,
      })
      .onConflictDoUpdate({
        target: jurorAssignments.id,
        set: { weight: powers[i], decision: null, decidedAt: null },
      });
  }
});

ponder.on("Engagements:JurorsAssigned", async ({ event, context }) => {
  const engagementId = Number(event.args.engagementId);
  const jurors = event.args.jurors as Address[];

  for (const juror of jurors) {
    await context.db
      .insert(jurorAssignments)
      .values({
        id: buildJurorAssignmentId(engagementId, juror),
        engagementId,
        juror,
        weight: null,
        decision: null,
        decidedAt: null,
      })
      .onConflictDoNothing();
  }
});

ponder.on("Engagements:EngagementVerified", async ({ event, context }) => {
  const engagementId = Number(event.args.engagementId);
  const decision = event.args.approve ? "APPROVE" : "REJECT";
  const decidedAt = toDate(event.block.timestamp);

  await context.db
    .update(jurorAssignments, { id: buildJurorAssignmentId(engagementId, event.args.verifier) })
    .set({ decision, decidedAt });
});

ponder.on("Engagements:EngagementResolved", async ({ event, context }) => {
  const status = engagementStatuses[Number(event.args.status)] ?? engagementStatuses[0];
  const resolvedAt = toDate(event.block.timestamp);

  await context.db
    .update(engagements, { id: Number(event.args.engagementId) })
    .set({ status, resolvedAt });
});

ponder.on("Engagements:EngagementRevoked", async ({ event, context }) => {
  const resolvedAt = toDate(event.block.timestamp);
  await context.db
    .update(engagements, { id: Number(event.args.engagementId) })
    .set({ status: engagementStatuses[3], resolvedAt });
});
