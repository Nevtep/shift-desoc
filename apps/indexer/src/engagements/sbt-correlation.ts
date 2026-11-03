export type CorrelatableEngagement = {
  communityId: number;
  participant: string;
  status: string;
  resolvedTxHash: string | null;
};

export type CorrelatableSbt = {
  communityId: number;
  subject: string;
  txHash: string;
};

/**
 * Correlation rule (SHI-19 S7): `Engagements._resolveEngagement` mints the engagement SBT in the same
 * transaction that emits `EngagementResolved`. An SBT therefore belongs to an APPROVED engagement iff it
 * was issued in the same community, to the participant, in the resolution transaction. Anything else
 * (other tx, other subject, other community) is unrelated and never linked.
 */
export function correlateEngagementSbts<T extends CorrelatableSbt>(
  engagement: CorrelatableEngagement,
  sbts: readonly T[]
): T[] {
  if (engagement.status !== "APPROVED" || !engagement.resolvedTxHash) return [];
  const participant = engagement.participant.toLowerCase();
  const txHash = engagement.resolvedTxHash.toLowerCase();
  return sbts.filter(
    (sbt) =>
      sbt.communityId === engagement.communityId &&
      sbt.subject.toLowerCase() === participant &&
      sbt.txHash.toLowerCase() === txHash
  );
}
