import { eq } from "@ponder/core";

import { engagementAppeals, engagements } from "../../ponder.schema";

// Indexer vocabulary; index matches Types.EngagementStatus (Pending, Approved, Rejected, Revoked).
export const engagementStatuses = ["PENDING", "APPROVED", "REJECTED", "REVOKED"] as const;

export type EventEvidence = {
  eventName: string;
  txHash: string;
  blockNumber: bigint;
};

export const buildEngagementProjectionId = (communityId: number, engagementId: number) =>
  `${communityId}:${engagementId}`;
export const buildAppealProjectionId = (communityId: number, appealId: number) => `${communityId}:${appealId}`;

const evidenceColumns = (evidence: EventEvidence) => ({
  lastEventName: evidence.eventName,
  lastEventTxHash: evidence.txHash,
  lastEventBlock: evidence.blockNumber,
});

// `db` is Ponder's context.db; typed loosely like the other projection helpers in this indexer.
type Db = any;

export type SubmittedInput = {
  communityId: number;
  engagementId: number;
  valuableActionId: number;
  participant: string;
  evidenceManifestCid: string;
  submittedAt: Date;
  evidence: EventEvidence;
};

export async function projectEngagementSubmitted(db: Db, input: SubmittedInput) {
  const fields = {
    communityId: input.communityId,
    valuableActionId: input.valuableActionId,
    participant: input.participant,
    status: engagementStatuses[0],
    evidenceManifestCid: input.evidenceManifestCid,
    submittedAt: input.submittedAt,
    resolvedAt: null,
    approvalsCount: null,
    rejectionsCount: null,
    revokedBy: null,
    ...evidenceColumns(input.evidence),
  };
  await db
    .insert(engagements)
    .values({
      id: buildEngagementProjectionId(input.communityId, input.engagementId),
      engagementId: input.engagementId,
      ...fields,
    })
    .onConflictDoUpdate(fields);
}

export type ResolvedInput = {
  communityId: number;
  engagementId: number;
  statusIndex: number;
  finalApprovals: number;
  finalRejections: number;
  resolvedAt: Date;
  evidence: EventEvidence;
};

export async function projectEngagementResolved(db: Db, input: ResolvedInput) {
  await db
    .update(engagements, { id: buildEngagementProjectionId(input.communityId, input.engagementId) })
    .set({
      status: engagementStatuses[input.statusIndex] ?? engagementStatuses[0],
      resolvedAt: input.resolvedAt,
      approvalsCount: input.finalApprovals,
      rejectionsCount: input.finalRejections,
      ...evidenceColumns(input.evidence),
    });
}

export type RevokedInput = {
  communityId: number;
  engagementId: number;
  revoker: string;
  resolvedAt: Date;
  evidence: EventEvidence;
};

export async function projectEngagementRevoked(db: Db, input: RevokedInput) {
  await db
    .update(engagements, { id: buildEngagementProjectionId(input.communityId, input.engagementId) })
    .set({
      status: engagementStatuses[3],
      resolvedAt: input.resolvedAt,
      revokedBy: input.revoker,
      ...evidenceColumns(input.evidence),
    });
}

export type AppealSubmittedInput = {
  communityId: number;
  appealId: number;
  engagementId: number;
  appellant: string;
  reason: string;
  submittedAt: Date;
  evidence: EventEvidence;
};

export async function projectAppealSubmitted(db: Db, input: AppealSubmittedInput) {
  const fields = {
    communityId: input.communityId,
    engagementId: input.engagementId,
    appellant: input.appellant,
    reason: input.reason,
    submittedAt: input.submittedAt,
    txHash: input.evidence.txHash,
    blockNumber: input.evidence.blockNumber,
  };
  // Replay-safe: a re-delivered AppealSubmitted must not reset a status written by AppealResolved.
  await db
    .insert(engagementAppeals)
    .values({
      id: buildAppealProjectionId(input.communityId, input.appealId),
      appealId: input.appealId,
      status: "PENDING",
      resolvedAt: null,
      ...fields,
    })
    .onConflictDoUpdate(fields);

  await db
    .update(engagements, { id: buildEngagementProjectionId(input.communityId, input.engagementId) })
    .set(evidenceColumns(input.evidence));
}

export type AppealResolvedInput = {
  communityId: number;
  appealId: number;
  statusIndex: number;
  resolvedAt: Date;
};

/**
 * `AppealResolved` is declared by the contract but never emitted today (SHI-19 Q1). The handler is
 * tolerant: it only updates an appeal that was projected, and never invents one.
 */
export async function projectAppealResolved(db: Db, input: AppealResolvedInput) {
  const id = buildAppealProjectionId(input.communityId, input.appealId);
  const rows = await db.select().from(engagementAppeals).where(eq(engagementAppeals.id, id)).limit(1);
  if (rows.length === 0) return false;
  await db.update(engagementAppeals, { id }).set({
    status: engagementStatuses[input.statusIndex] ?? engagementStatuses[0],
    resolvedAt: input.resolvedAt,
  });
  return true;
}
