import { engagementSbts } from "../../ponder.schema";

// ValuableActionSBT.TokenKind order.
export const sbtKinds = ["WORK", "ROLE", "CREDENTIAL", "POSITION", "INVESTMENT"] as const;

export type TokenIssuedInput = {
  communityId: number;
  tokenId: number;
  kind: number;
  subject: string;
  issuedAt: Date;
  txHash: string;
  blockNumber: bigint;
};

export const buildSbtProjectionId = (communityId: number, tokenId: number) => `${communityId}:${tokenId}`;

export async function projectTokenIssued(db: any, input: TokenIssuedInput) {
  const fields = {
    communityId: input.communityId,
    kind: sbtKinds[input.kind] ?? String(input.kind),
    subject: input.subject,
    issuedAt: input.issuedAt,
    txHash: input.txHash,
    blockNumber: input.blockNumber,
  };
  await db
    .insert(engagementSbts)
    .values({ id: buildSbtProjectionId(input.communityId, input.tokenId), tokenId: input.tokenId, ...fields })
    .onConflictDoUpdate(fields);
}
