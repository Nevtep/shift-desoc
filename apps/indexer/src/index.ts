import { and, count, desc, eq, graphql } from "@ponder/core";
import {
  engagements,
  valuableActions,
  comments,
  communities,
  draftReviews,
  draftVersions,
  drafts,
  emitterMappingActive,
  emitterMappingWindows,
  jurorAssignments,
  proposalVotes,
  proposals,
  requests,
  unmappedEmitterAlerts,
} from "../ponder.schema";

import { keccak256, toBytes, type Address } from "viem";
import { ponder } from "@/generated";
import { contractModuleKeyAllowlists } from "./discovery/module-key-allowlists";
import { applyModuleAddressUpdate } from "./discovery/mapping-windows";
import { normalizeModuleKey } from "./discovery/module-keys";
import { resolveCommunityFromEmitter } from "./discovery/resolve-community-from-emitter";
import { writeUnmappedEmitterTelemetry } from "./discovery/unmapped-emitter-telemetry";
import {
  reduceValuableActionLifecycle,
  toValuableActionProjectionId,
  type ValuableActionProjectionState,
} from "./valuable-actions/projection";

// --- API ROUTES (Hono via Ponder) -------------------------------------------------

// Expose GraphQL endpoint for the web app and tooling.
ponder.use("/graphql", graphql());

ponder.get("/api/health", (c) => c.json({ ok: true }));

ponder.get("/api/discovery/health", async (c) => {
  const [activeCountRow] = await c.db.select({ count: count() }).from(emitterMappingActive);
  const [unmappedCountRow] = await c.db.select({ count: count() }).from(unmappedEmitterAlerts);

  return c.json({
    activeEmitterMappings: Number(activeCountRow?.count ?? 0),
    unmappedEmitterAlerts: Number(unmappedCountRow?.count ?? 0),
  });
});

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
  const requestKey = c.req.param("id");
  if (!requestKey || !requestKey.includes(":")) return c.json({ error: "invalid request id" }, 400);

  const request = await c.db.select().from(requests).where(eq(requests.id, requestKey)).limit(1);
  if (request.length === 0) return c.json({ error: "not found" }, 404);

  const requestRow = request[0]!;

  const commentsForRequest = await c.db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.communityId, requestRow.communityId),
        eq(comments.requestId, requestRow.requestId)
      )
    )
    .orderBy(desc(comments.createdAt));

  const draftsForRequest = await c.db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.communityId, requestRow.communityId),
        eq(drafts.requestId, requestRow.requestId)
      )
    )
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
  const draftKey = c.req.param("id");
  if (!draftKey || !draftKey.includes(":")) return c.json({ error: "invalid draft id" }, 400);

  const draft = await c.db.select().from(drafts).where(eq(drafts.id, draftKey)).limit(1);
  if (draft.length === 0) return c.json({ error: "not found" }, 404);

  const draftRow = draft[0]!;

  const versions = await c.db
    .select()
    .from(draftVersions)
    .where(and(eq(draftVersions.communityId, draftRow.communityId), eq(draftVersions.draftId, draftRow.draftId)))
    .orderBy(desc(draftVersions.versionNumber));

  const reviews = await c.db
    .select()
    .from(draftReviews)
    .where(and(eq(draftReviews.communityId, draftRow.communityId), eq(draftReviews.draftId, draftRow.draftId)))
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
  const proposalKey = c.req.param("id");
  const proposal = await c.db.select().from(proposals).where(eq(proposals.id, proposalKey)).limit(1);
  if (proposal.length === 0) return c.json({ error: "not found" }, 404);

  const proposalRow = proposal[0]!;

  const votes = await c.db
    .select()
    .from(proposalVotes)
    .where(
      and(
        eq(proposalVotes.communityId, proposalRow.communityId),
        eq(proposalVotes.proposalId, proposalRow.proposalId)
      )
    )
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
  const engagementKey = c.req.param("id");
  if (!engagementKey || !engagementKey.includes(":")) return c.json({ error: "invalid engagement id" }, 400);

  const engagement = await c.db.select().from(engagements).where(eq(engagements.id, engagementKey)).limit(1);
  if (engagement.length === 0) return c.json({ error: "not found" }, 404);

  const engagementRow = engagement[0]!;

  const jurors = await c.db
    .select()
    .from(jurorAssignments)
    .where(
      and(
        eq(jurorAssignments.communityId, engagementRow.communityId),
        eq(jurorAssignments.engagementId, engagementRow.engagementId)
      )
    )
    .orderBy(desc(jurorAssignments.weight));

  return c.json({ engagement: engagement[0], jurors });
});

ponder.get("/communities/:communityId/valuable-actions", async (c) => {
  const communityId = Number(c.req.param("communityId"));
  if (!Number.isFinite(communityId) || communityId <= 0) {
    return c.json({ error: "invalid community id" }, 400);
  }

  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
  const rows = await c.db
    .select()
    .from(valuableActions)
    .where(eq(valuableActions.communityId, communityId))
    .orderBy(desc(valuableActions.actionId))
    .limit(limit)
    .offset(offset);

  return c.json({
    communityId,
    items: rows,
    nextOffset: offset + rows.length,
  });
});

ponder.get("/communities/:communityId/valuable-actions/:actionId", async (c) => {
  const communityId = Number(c.req.param("communityId"));
  const actionId = Number(c.req.param("actionId"));
  if (!Number.isFinite(communityId) || communityId <= 0 || !Number.isFinite(actionId) || actionId < 0) {
    return c.json({ error: "invalid identifiers" }, 400);
  }

  const id = toValuableActionProjectionId(communityId, actionId);
  const rows = await c.db.select().from(valuableActions).where(eq(valuableActions.id, id)).limit(1);
  if (rows.length === 0) return c.json({ error: "not found" }, 404);

  return c.json({ communityId, actionId, item: rows[0] });
});

ponder.get("/communities/:communityId/valuable-actions/readiness", async (c) => {
  const communityId = Number(c.req.param("communityId"));
  if (!Number.isFinite(communityId) || communityId <= 0) {
    return c.json({ error: "invalid community id" }, 400);
  }

  const rows = await c.db
    .select()
    .from(valuableActions)
    .where(eq(valuableActions.communityId, communityId))
    .orderBy(desc(valuableActions.updatedAtBlock))
    .limit(1);

  if (rows.length === 0) {
    return c.json({
      status: "unavailable",
      indexedBlock: null,
      chainHeadBlock: null,
      blockLag: null,
      indexedAt: null,
      details: "No Valuable Action projection data available for this community.",
    });
  }

  const head = rows[0]!;
  const nowMs = Date.now();
  const updatedMs = new Date(head.updatedAt).getTime();
  const ageMs = Math.max(nowMs - updatedMs, 0);
  const status = ageMs > 180_000 ? "lagging" : "healthy";

  return c.json({
    status,
    indexedBlock: head.updatedAtBlock.toString(),
    chainHeadBlock: head.updatedAtBlock.toString(),
    blockLag: "0",
    indexedAt: head.updatedAt.toISOString(),
    details: status === "healthy" ? "Projection is up to date." : "Projection update appears delayed.",
  });
});

ponder.get("/communities/:communityId/valuable-actions/:actionId/authority", async (c) => {
  const communityId = Number(c.req.param("communityId"));
  const actionId = Number(c.req.param("actionId"));
  if (!Number.isFinite(communityId) || communityId <= 0 || !Number.isFinite(actionId) || actionId < 0) {
    return c.json({ error: "invalid identifiers" }, 400);
  }

  const boundaryValid = true;
  const operations = ["create", "edit", "activate", "deactivate"].map((operation) => ({
    operation,
    mode: "blocked",
    reasonCode: "authority_not_resolved",
    reasonMessage: "Authority resolution is unavailable for this route.",
    evaluatedAtBlock: null,
  }));

  return c.json({
    communityId,
    actionId,
    boundaryValid,
    operations,
  });
});

ponder.post("/communities/:communityId/valuable-actions/boundary-check", async (c) => {
  const communityId = Number(c.req.param("communityId"));
  const body = await c.req.json().catch(() => ({}));
  const actionId = Number((body as { actionId?: number | string }).actionId ?? -1);
  const boundaryValid = Number.isFinite(communityId) && communityId > 0 && Number.isFinite(actionId) && actionId >= 0;

  return c.json({
    communityId,
    actionId,
    boundaryValid,
    reasonCode: boundaryValid ? "ok" : "invalid_input",
    reasonMessage: boundaryValid ? "Boundary check passed." : "Invalid community or action identifier.",
  });
});

// --- EVENT HANDLERS -------------------------------------------------------------

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

const buildRequestId = (communityId: number, requestId: number) => `${communityId}:${requestId}`;
const buildCommentId = (communityId: number, commentId: number) => `${communityId}:${commentId}`;
const buildDraftId = (communityId: number, draftId: number) => `${communityId}:${draftId}`;
const buildDraftVersionId = (communityId: number, draftId: number, versionNumber: number) =>
  `${communityId}:${draftId}:${versionNumber}`;
const buildReviewId = (communityId: number, draftId: number, reviewer: Address) =>
  `${communityId}:${draftId}:${reviewer.toLowerCase()}`;
const buildProposalId = (communityId: number, proposalId: bigint | string) => `${communityId}:${proposalId.toString()}`;
const buildVoteId = (communityId: number, proposalId: bigint, voter: Address) =>
  `${communityId}:${proposalId.toString()}:${voter.toLowerCase()}`;
const buildEngagementId = (communityId: number, engagementId: number) => `${communityId}:${engagementId}`;
const buildValuableActionId = (communityId: number, actionId: number) => `${communityId}:${actionId}`;
const buildJurorAssignmentId = (communityId: number, engagementId: number, juror: Address) =>
  `${communityId}:${engagementId}:${juror.toLowerCase()}`;

const asValuableActionProjection = (current: any): ValuableActionProjectionState | null => {
  if (!current) return null;
  return {
    communityId: Number(current.communityId),
    actionId: Number(current.actionId),
    titleTemplate: current.titleTemplate,
    evidenceSpecCid: current.evidenceSpecCid,
    metadataSchemaId: current.metadataSchemaId,
    isActive: Boolean(current.isActive),
    createdAtBlock: BigInt(current.createdAtBlock),
    updatedAtBlock: BigInt(current.updatedAtBlock),
    activatedAtBlock: current.activatedAtBlock ? BigInt(current.activatedAtBlock) : null,
    deactivatedAtBlock: current.deactivatedAtBlock ? BigInt(current.deactivatedAtBlock) : null,
    lastEventTxHash: String(current.lastEventTxHash),
    lastEventName: String(current.lastEventName),
  };
};

async function upsertValuableActionProjection({
  context,
  communityId,
  actionId,
  next,
  event,
}: {
  context: any;
  communityId: number;
  actionId: number;
  next: ValuableActionProjectionState;
  event: any;
}) {
  const now = toDate(BigInt(event.block.timestamp));

  await context.db
    .insert(valuableActions)
    .values({
      id: buildValuableActionId(communityId, actionId),
      communityId,
      actionId,
      titleTemplate: next.titleTemplate,
      evidenceSpecCid: next.evidenceSpecCid,
      metadataSchemaId: next.metadataSchemaId,
      isActive: next.isActive,
      createdAtBlock: next.createdAtBlock,
      updatedAtBlock: next.updatedAtBlock,
      activatedAtBlock: next.activatedAtBlock,
      deactivatedAtBlock: next.deactivatedAtBlock,
      lastEventTxHash: next.lastEventTxHash,
      lastEventName: next.lastEventName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      titleTemplate: next.titleTemplate,
      evidenceSpecCid: next.evidenceSpecCid,
      metadataSchemaId: next.metadataSchemaId,
      isActive: next.isActive,
      updatedAtBlock: next.updatedAtBlock,
      activatedAtBlock: next.activatedAtBlock,
      deactivatedAtBlock: next.deactivatedAtBlock,
      lastEventTxHash: next.lastEventTxHash,
      lastEventName: next.lastEventName,
      updatedAt: now,
    });
}

const getEventMeta = (event: any) => ({
  emitterAddress: String(event?.log?.address ?? "").toLowerCase(),
  blockNumber: BigInt(event?.block?.number ?? 0n),
  logIndex: Number(event?.log?.logIndex ?? 0),
  txHash: String(event?.transaction?.hash ?? ""),
  timestamp: toDate(BigInt(event.block.timestamp)),
  eventName: String(event?.name ?? "unknown"),
});

const resolveOrAlert = async (
  context: any,
  event: any,
  contractName: keyof typeof contractModuleKeyAllowlists
) => {
  const meta = getEventMeta(event);
  const expectedModuleKeys = contractModuleKeyAllowlists[contractName];
  const resolved = await resolveCommunityFromEmitter({
    db: context.db,
    emitterAddress: meta.emitterAddress,
    blockNumber: meta.blockNumber,
    expectedModuleKeys,
  });

  if (resolved) {
    return resolved;
  }

  // Recovery path for events that emit communityId directly.
  // This seeds mapping windows on first-seen module emitters and avoids deterministic drops.
  const communityIdFromEvent = Number(event?.args?.communityId);
  if (
    Number.isFinite(communityIdFromEvent) &&
    communityIdFromEvent > 0 &&
    expectedModuleKeys &&
    expectedModuleKeys.length === 1
  ) {
    const moduleKey = String(expectedModuleKeys[0]);
    await applyModuleAddressUpdate(
      {
        db: context.db,
        network: context.network,
      },
      {
        communityId: communityIdFromEvent,
        moduleKey,
        oldAddress: "0x0000000000000000000000000000000000000000",
        newAddress: meta.emitterAddress,
        blockNumber: meta.blockNumber,
        logIndex: meta.logIndex,
        txHash: meta.txHash,
        timestamp: meta.timestamp,
      }
    );

    return {
      communityId: communityIdFromEvent,
      moduleKey,
    };
  }

  await writeUnmappedEmitterTelemetry({
    db: context.db,
    chainId: context.network.chainId,
    emitterAddress: meta.emitterAddress,
    moduleKeyHint: expectedModuleKeys?.join(",") ?? undefined,
    eventName: meta.eventName,
    blockNumber: meta.blockNumber,
    txHash: meta.txHash,
    logIndex: meta.logIndex,
    timestamp: meta.timestamp,
  });

  return null;
};

ponder.on("CommunityRegistry:CommunityRegistered", async ({ event, context }) => {
  const createdAt = toDate(event.block.timestamp);
  const communityId = Number(event.args.communityId);
  const payload = {
    chainId: context.network.chainId,
    name: event.args.name,
    metadataUri: null,
    parentCommunityId: Number(event.args.parentCommunityId),
    createdAt,
  };

  await context.db
    .insert(communities)
    .values({
      id: communityId,
      ...payload,
    })
    .onConflictDoNothing();

  await context.db
    .update(communities, { id: communityId })
    .set(payload);
});

ponder.on("CommunityRegistry:CommunityMetadataURIUpdated", async ({ event, context }) => {
  const communityId = Number(event.args.communityId);

  await context.db
    .update(communities, { id: communityId })
    .set({ metadataUri: event.args.newMetadataURI });
});

ponder.on("CommunityRegistry:CommunityParentUpdated", async ({ event, context }) => {
  const communityId = Number(event.args.communityId);

  await context.db
    .update(communities, { id: communityId })
    .set({ parentCommunityId: Number(event.args.newParentCommunityId) });
});

ponder.on("CommunityRegistry:ModuleAddressUpdated", async ({ event, context }) => {
  const meta = getEventMeta(event);

  await applyModuleAddressUpdate(
    {
      db: context.db,
      network: context.network,
    },
    {
      communityId: Number(event.args.communityId),
      moduleKey: normalizeModuleKey(String(event.args.moduleKey)),
      oldAddress: String(event.args.oldAddress),
      newAddress: String(event.args.newAddress),
      blockNumber: meta.blockNumber,
      logIndex: meta.logIndex,
      txHash: meta.txHash,
      timestamp: meta.timestamp,
    }
  );
});

ponder.on("RequestHub:RequestCreated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "RequestHub");
  if (!resolved) return;

  const requestId = Number(event.args.requestId);

  await context.db
    .insert(requests)
    .values({
      id: buildRequestId(resolved.communityId, requestId),
      requestId,
      communityId: resolved.communityId,
      author: event.args.author,
      status: requestStatuses[0],
      cid: event.args.cid,
      tags: event.args.tags,
      createdAt: toDate(event.block.timestamp),
    })
    .onConflictDoNothing();
});

ponder.on("RequestHub:CommentPosted", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "RequestHub");
  if (!resolved) return;

  const commentId = Number(event.args.commentId);

  await context.db
    .insert(comments)
    .values({
      id: buildCommentId(resolved.communityId, commentId),
      commentId,
      communityId: resolved.communityId,
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
  const resolved = await resolveOrAlert(context, event, "RequestHub");
  if (!resolved) return;

  const requestId = Number(event.args.requestId);
  const statusIndex = Number(event.args.newStatus);
  await context.db
    .update(requests, { id: buildRequestId(resolved.communityId, requestId) })
    .set({ status: requestStatuses[statusIndex] ?? requestStatuses[0] });
});

ponder.on("RequestHub:CommentModerated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "RequestHub");
  if (!resolved) return;

  await context.db
    .update(comments, { id: buildCommentId(resolved.communityId, Number(event.args.commentId)) })
    .set({ isModerated: event.args.hidden });
});

ponder.on("DraftsManager:DraftCreated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const now = toDate(event.block.timestamp);
  const draftId = Number(event.args.draftId);
  const draftKey = buildDraftId(resolved.communityId, draftId);
  const actionBundle = await readDraftActionBundleOrFallback({ context, event, draftId });

  await context.db
    .insert(drafts)
    .values({
      id: draftKey,
      draftId,
      communityId: resolved.communityId,
      requestId: Number(event.args.requestId),
      status: draftStatuses[0],
      targets: actionBundle.targets,
      values: actionBundle.values,
      calldatas: actionBundle.calldatas,
      actionsHash: actionBundle.actionsHash,
      latestVersionCid: event.args.versionCID,
      escalatedProposalId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      communityId: resolved.communityId,
      requestId: Number(event.args.requestId),
      status: draftStatuses[0],
      targets: actionBundle.targets,
      values: actionBundle.values,
      calldatas: actionBundle.calldatas,
      actionsHash: actionBundle.actionsHash,
      latestVersionCid: event.args.versionCID,
      updatedAt: now,
    });

  await context.db
    .insert(draftVersions)
    .values({
      id: buildDraftVersionId(resolved.communityId, draftId, 0),
      communityId: resolved.communityId,
      draftId,
      versionNumber: 0,
      cid: event.args.versionCID,
      contributor: event.args.author,
      createdAt: now,
    })
    .onConflictDoNothing();
});

async function readDraftActionBundleOrFallback({
  context,
  event,
  draftId,
}: {
  context: any;
  event: any;
  draftId: number;
}) {
  const fallbackHash = String(event.args.actionsHash ?? "0x");

  try {
    const onchainDraft = await context.client.readContract({
      abi: event.abi,
      address: event.log.address,
      functionName: "getDraft",
      args: [BigInt(draftId)],
    });

    const tuple = onchainDraft as {
      actions?: {
        targets?: string[];
        values?: bigint[];
        calldatas?: string[];
        actionsHash?: string;
      };
      [index: number]: unknown;
    };

    const actionsTuple = (tuple.actions ?? tuple[4] ?? {}) as {
      targets?: unknown;
      values?: unknown;
      calldatas?: unknown;
      actionsHash?: unknown;
      [index: number]: unknown;
    };

    const targets = Array.isArray(actionsTuple.targets)
      ? actionsTuple.targets.map((value) => String(value))
      : Array.isArray(actionsTuple[0])
      ? (actionsTuple[0] as unknown[]).map((value) => String(value))
      : [];

    const valuesRaw = Array.isArray(actionsTuple.values)
      ? actionsTuple.values
      : Array.isArray(actionsTuple[1])
      ? (actionsTuple[1] as unknown[])
      : [];

    const values = valuesRaw.map((value) => {
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "number") return Math.trunc(value).toString();
      return String(value);
    });

    const calldatas = Array.isArray(actionsTuple.calldatas)
      ? actionsTuple.calldatas.map((value) => String(value))
      : Array.isArray(actionsTuple[2])
      ? (actionsTuple[2] as unknown[]).map((value) => String(value))
      : [];

    const actionsHashCandidate =
      typeof actionsTuple.actionsHash === "string"
        ? actionsTuple.actionsHash
        : typeof actionsTuple[3] === "string"
        ? String(actionsTuple[3])
        : fallbackHash;

    return {
      targets,
      values,
      calldatas,
      actionsHash: actionsHashCandidate,
    };
  } catch (error) {
    console.warn("[indexer] failed to enrich draft action bundle from chain, using fallback", {
      draftId,
      error,
    });

    return {
      targets: [],
      values: [],
      calldatas: [],
      actionsHash: fallbackHash,
    };
  }
}

ponder.on("DraftsManager:VersionSnapshot", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const draftId = Number(event.args.draftId);
  const versionNumber = Number(event.args.versionNumber);
  const createdAt = toDate(event.block.timestamp);
  const draftKey = buildDraftId(resolved.communityId, draftId);

  await context.db
    .insert(draftVersions)
    .values({
      id: buildDraftVersionId(resolved.communityId, draftId, versionNumber),
      communityId: resolved.communityId,
      draftId,
      versionNumber,
      cid: event.args.versionCID,
      contributor: event.args.contributor,
      createdAt,
    })
    .onConflictDoUpdate({ cid: event.args.versionCID, contributor: event.args.contributor, createdAt });

  await context.db
    .update(drafts, { id: draftKey })
    .set({ latestVersionCid: event.args.versionCID, updatedAt: createdAt });
});

ponder.on("DraftsManager:ReviewSubmitted", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const draftId = Number(event.args.draftId);
  const createdAt = toDate(event.block.timestamp);
  const stance = reviewTypes[Number(event.args.reviewType)] ?? reviewTypes[0];

  await context.db
    .insert(draftReviews)
    .values({
      id: buildReviewId(resolved.communityId, draftId, event.args.reviewer),
      communityId: resolved.communityId,
      draftId,
      reviewer: event.args.reviewer,
      stance,
      commentCid: event.args.reasonCID,
      createdAt,
    })
    .onConflictDoUpdate({ stance, commentCid: event.args.reasonCID, createdAt });
});

ponder.on("DraftsManager:ReviewRetracted", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const draftId = Number(event.args.draftId);
  await context.db.delete(draftReviews, { id: buildReviewId(resolved.communityId, draftId, event.args.reviewer) });
});

ponder.on("DraftsManager:DraftStatusChanged", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const draftId = Number(event.args.draftId);
  const status = draftStatuses[Number(event.args.newStatus)] ?? draftStatuses[0];
  const updatedAt = toDate(event.block.timestamp);

  await context.db
    .update(drafts, { id: buildDraftId(resolved.communityId, draftId) })
    .set({ status, updatedAt });
});

ponder.on("DraftsManager:ProposalEscalated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const draftId = Number(event.args.draftId);
  const proposalId = event.args.proposalId;
  const proposalKey = buildProposalId(resolved.communityId, proposalId);
  const createdAt = toDate(event.block.timestamp);
  const multiChoiceOptions = event.args.isMultiChoice
    ? Array.from({ length: Number(event.args.numOptions) }, (_, i) => i)
    : null;

  await context.db
    .update(drafts, { id: buildDraftId(resolved.communityId, draftId) })
    .set({ escalatedProposalId: proposalKey, status: draftStatuses[3], updatedAt: createdAt });

  await context.db
    .insert(proposals)
    .values({
      id: proposalKey,
      proposalId: proposalId.toString(),
      communityId: resolved.communityId,
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
    .onConflictDoUpdate({ multiChoiceOptions, state: "Active", createdAt });
});

ponder.on("DraftsManager:ProposalOutcomeUpdated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "DraftsManager");
  if (!resolved) return;

  const proposalId = event.args.proposalId.toString();
  const outcome = draftStatuses[Number(event.args.outcome)] ?? draftStatuses[5];
  const updatedAt = toDate(event.block.timestamp);

  await context.db
    .update(drafts, { id: buildDraftId(resolved.communityId, Number(event.args.draftId)) })
    .set({ status: outcome, updatedAt });

  await context.db
    .update(proposals, { id: buildProposalId(resolved.communityId, proposalId) })
    .set({ state: outcome });
});

ponder.on("ShiftGovernor:ProposalCreated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const createdAt = toDate(event.block.timestamp);
  const proposalKey = buildProposalId(resolved.communityId, event.args.proposalId);
  const description = event.args.description;
  const descriptionHash = keccak256(toBytes(description));

  await context.db
    .insert(proposals)
    .values({
      id: proposalKey,
      proposalId: event.args.proposalId.toString(),
      communityId: resolved.communityId,
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
      proposer: event.args.proposer,
      descriptionCid: description,
      descriptionHash,
      targets: event.args.targets,
      values: event.args.values.map((val) => val.toString()),
      calldatas: event.args.calldatas,
      state: "Active",
      createdAt,
    });
});

ponder.on("ShiftGovernor:MultiChoiceProposalCreated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const createdAt = toDate(event.block.timestamp);
  const proposalKey = buildProposalId(resolved.communityId, event.args.proposalId);
  const descriptionHash = keccak256(toBytes(event.args.description));
  const options = Array.from({ length: Number(event.args.numOptions) }, (_, i) => i);

  await context.db
    .insert(proposals)
    .values({
      id: proposalKey,
      proposalId: event.args.proposalId.toString(),
      communityId: resolved.communityId,
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
      proposer: event.args.proposer,
      descriptionCid: event.args.description,
      descriptionHash,
      targets: event.args.targets,
      values: event.args.values.map((val) => val.toString()),
      calldatas: event.args.calldatas,
      state: "Active",
      multiChoiceOptions: options,
    });
});

ponder.on("CountingMultiChoice:MultiChoiceEnabled", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "CountingMultiChoice");
  if (!resolved) return;

  const options = Array.from({ length: Number(event.args.options) }, (_, i) => i);
  await context.db
    .update(proposals, { id: buildProposalId(resolved.communityId, event.args.proposalId) })
    .set({ multiChoiceOptions: options });
});

ponder.on("ShiftGovernor:ProposalQueued", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const queuedAt = toDate(event.block.timestamp);
  await context.db
    .update(proposals, { id: buildProposalId(resolved.communityId, event.args.proposalId) })
    .set({ state: "Queued", queuedAt });
});

ponder.on("ShiftGovernor:ProposalExecuted", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const executedAt = toDate(event.block.timestamp);
  await context.db
    .update(proposals, { id: buildProposalId(resolved.communityId, event.args.proposalId) })
    .set({ state: "Executed", executedAt });
});

ponder.on("CountingMultiChoice:ProposalCanceled", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "CountingMultiChoice");
  if (!resolved) return;

  await context.db
    .update(proposals, { id: buildProposalId(resolved.communityId, event.args.proposalId) })
    .set({ state: "Canceled" });
});

ponder.on("ShiftGovernor:VoteCast", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(resolved.communityId, event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      communityId: resolved.communityId,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.weight,
      optionIndex: Number(event.args.support),
      castAt,
    })
    .onConflictDoUpdate({ weight: event.args.weight, optionIndex: Number(event.args.support), castAt });
});

ponder.on("CountingMultiChoice:VoteCastMulti", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "CountingMultiChoice");
  if (!resolved) return;

  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(resolved.communityId, event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      communityId: resolved.communityId,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.totalWeight,
      optionIndex: null,
      castAt,
    })
    .onConflictDoUpdate({ weight: event.args.totalWeight, optionIndex: null, castAt });
});

ponder.on("ShiftGovernor:MultiChoiceVoteCast", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ShiftGovernor");
  if (!resolved) return;

  const castAt = toDate(event.block.timestamp);
  const id = buildVoteId(resolved.communityId, event.args.proposalId, event.args.voter);

  await context.db
    .insert(proposalVotes)
    .values({
      id,
      communityId: resolved.communityId,
      proposalId: event.args.proposalId.toString(),
      voter: event.args.voter,
      weight: event.args.totalWeight,
      optionIndex: null,
      castAt,
    })
    .onConflictDoUpdate({ weight: event.args.totalWeight, optionIndex: null, castAt });
});

ponder.on("Engagements:EngagementSubmitted", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "Engagements");
  if (!resolved) return;

  const engagementId = Number(event.args.engagementId);
  const submittedAt = toDate(event.block.timestamp);
  await context.db
    .insert(engagements)
    .values({
      id: buildEngagementId(resolved.communityId, engagementId),
      engagementId,
      communityId: resolved.communityId,
      valuableActionId: Number(event.args.typeId),
      participant: event.args.participant,
      status: engagementStatuses[0],
      evidenceManifestCid: event.args.evidenceCID,
      submittedAt,
      resolvedAt: null,
    })
    .onConflictDoUpdate({
      communityId: resolved.communityId,
      valuableActionId: Number(event.args.typeId),
      participant: event.args.participant,
      status: engagementStatuses[0],
      evidenceManifestCid: event.args.evidenceCID,
      submittedAt,
      resolvedAt: null,
    });
});

ponder.on("VerifierManager:JurorsSelected", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "VerifierManager");
  if (!resolved) return;

  const engagementId = Number(event.args.engagementId);
  const jurors = event.args.jurors as Address[];
  const powers = event.args.powers as bigint[];

  await context.db
    .update(engagements, { id: buildEngagementId(resolved.communityId, engagementId) })
    .set({ communityId: resolved.communityId });

  for (let i = 0; i < jurors.length; i += 1) {
    const juror = jurors[i]!;
    await context.db
      .insert(jurorAssignments)
      .values({
        id: buildJurorAssignmentId(resolved.communityId, engagementId, juror),
        communityId: resolved.communityId,
        engagementId,
        juror,
        weight: powers[i],
        decision: null,
        decidedAt: null,
      })
      .onConflictDoUpdate({ weight: powers[i], decision: null, decidedAt: null });
  }
});

ponder.on("Engagements:JurorsAssigned", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "Engagements");
  if (!resolved) return;

  const engagementId = Number(event.args.engagementId);
  const jurors = event.args.jurors as Address[];

  for (const juror of jurors) {
    await context.db
      .insert(jurorAssignments)
      .values({
        id: buildJurorAssignmentId(resolved.communityId, engagementId, juror),
        communityId: resolved.communityId,
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
  const resolved = await resolveOrAlert(context, event, "Engagements");
  if (!resolved) return;

  const engagementId = Number(event.args.engagementId);
  const decision = event.args.approve ? "APPROVE" : "REJECT";
  const decidedAt = toDate(event.block.timestamp);

  await context.db
    .update(jurorAssignments, { id: buildJurorAssignmentId(resolved.communityId, engagementId, event.args.verifier) })
    .set({ decision, decidedAt });
});

ponder.on("Engagements:EngagementResolved", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "Engagements");
  if (!resolved) return;

  const status = engagementStatuses[Number(event.args.status)] ?? engagementStatuses[0];
  const resolvedAt = toDate(event.block.timestamp);

  await context.db
    .update(engagements, { id: buildEngagementId(resolved.communityId, Number(event.args.engagementId)) })
    .set({ status, resolvedAt });
});

ponder.on("Engagements:EngagementRevoked", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "Engagements");
  if (!resolved) return;

  const resolvedAt = toDate(event.block.timestamp);
  await context.db
    .update(engagements, { id: buildEngagementId(resolved.communityId, Number(event.args.engagementId)) })
    .set({ status: engagementStatuses[3], resolvedAt });
});

ponder.on("ValuableActionRegistry:ValuableActionCreated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ValuableActionRegistry");
  if (!resolved) return;

  const actionId = Number(event.args.id);
  const id = buildValuableActionId(resolved.communityId, actionId);
  const currentRows = await context.db.select().from(valuableActions).where(eq(valuableActions.id, id)).limit(1);
  const current = asValuableActionProjection(currentRows[0]);
  const va = event.args.valuableAction as any;
  const next = reduceValuableActionLifecycle(current, {
    kind: "created",
    communityId: resolved.communityId,
    actionId,
    titleTemplate: (va?.titleTemplate as string | undefined) ?? null,
    evidenceSpecCid: (va?.evidenceSpecCID as string | undefined) ?? null,
    metadataSchemaId: (va?.metadataSchemaId as string | undefined) ?? null,
    blockNumber: BigInt(event.block.number),
    txHash: String(event.transaction.hash),
  });

  await upsertValuableActionProjection({
    context,
    communityId: resolved.communityId,
    actionId,
    next,
    event,
  });
});

ponder.on("ValuableActionRegistry:ValuableActionUpdated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ValuableActionRegistry");
  if (!resolved) return;

  const actionId = Number(event.args.id);
  const id = buildValuableActionId(resolved.communityId, actionId);
  const currentRows = await context.db.select().from(valuableActions).where(eq(valuableActions.id, id)).limit(1);
  const current = asValuableActionProjection(currentRows[0]);
  const va = event.args.valuableAction as any;
  const next = reduceValuableActionLifecycle(current, {
    kind: "updated",
    communityId: resolved.communityId,
    actionId,
    titleTemplate: (va?.titleTemplate as string | undefined) ?? null,
    evidenceSpecCid: (va?.evidenceSpecCID as string | undefined) ?? null,
    metadataSchemaId: (va?.metadataSchemaId as string | undefined) ?? null,
    blockNumber: BigInt(event.block.number),
    txHash: String(event.transaction.hash),
  });

  await upsertValuableActionProjection({
    context,
    communityId: resolved.communityId,
    actionId,
    next,
    event,
  });
});

ponder.on("ValuableActionRegistry:ValuableActionActivated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ValuableActionRegistry");
  if (!resolved) return;

  const actionId = Number(event.args.id);
  const id = buildValuableActionId(resolved.communityId, actionId);
  const currentRows = await context.db.select().from(valuableActions).where(eq(valuableActions.id, id)).limit(1);
  const current = asValuableActionProjection(currentRows[0]);
  const next = reduceValuableActionLifecycle(current, {
    kind: "activated",
    communityId: resolved.communityId,
    actionId,
    blockNumber: BigInt(event.block.number),
    txHash: String(event.transaction.hash),
  });

  await upsertValuableActionProjection({
    context,
    communityId: resolved.communityId,
    actionId,
    next,
    event,
  });
});

ponder.on("ValuableActionRegistry:ValuableActionDeactivated", async ({ event, context }) => {
  const resolved = await resolveOrAlert(context, event, "ValuableActionRegistry");
  if (!resolved) return;

  const actionId = Number(event.args.id);
  const id = buildValuableActionId(resolved.communityId, actionId);
  const currentRows = await context.db.select().from(valuableActions).where(eq(valuableActions.id, id)).limit(1);
  const current = asValuableActionProjection(currentRows[0]);
  const next = reduceValuableActionLifecycle(current, {
    kind: "deactivated",
    communityId: resolved.communityId,
    actionId,
    blockNumber: BigInt(event.block.number),
    txHash: String(event.transaction.hash),
  });

  await upsertValuableActionProjection({
    context,
    communityId: resolved.communityId,
    actionId,
    next,
    event,
  });
});
