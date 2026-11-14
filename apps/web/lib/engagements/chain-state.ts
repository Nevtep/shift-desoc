import { normalizeEngagementStatus, type EngagementStatus } from "./engagement-status";

// Types.EngagementStatus order (contracts/libs/Types.sol): Pending, Approved, Rejected, Revoked.
const CHAIN_STATUS_BY_INDEX: EngagementStatus[] = ["PENDING", "APPROVED", "REJECTED", "REVOKED"];

export type ChainEngagement = {
  valuableActionId: number;
  participant: string;
  evidenceCid: string;
  status: EngagementStatus;
  createdAt: Date;
  verifyDeadline: Date;
  jurors: string[];
  approvals: number;
  rejections: number;
  resolved: boolean;
};

/** Normalizes the `Engagements.getEngagement` return tuple (viem returns it as a positional array). */
export function parseChainEngagement(raw: unknown): ChainEngagement | null {
  if (!Array.isArray(raw) || raw.length < 10) return null;
  const [typeId, participant, evidenceCid, status, createdAt, verifyDeadline, jurors, approvals, rejections, resolved] =
    raw as [bigint, string, string, number | bigint, bigint | number, bigint | number, string[], number | bigint, number | bigint, boolean];
  const mapped = CHAIN_STATUS_BY_INDEX[Number(status)];
  if (!mapped) return null;
  return {
    valuableActionId: Number(typeId),
    participant,
    evidenceCid,
    status: mapped,
    createdAt: new Date(Number(createdAt) * 1000),
    verifyDeadline: new Date(Number(verifyDeadline) * 1000),
    jurors: [...jurors],
    approvals: Number(approvals),
    rejections: Number(rejections),
    resolved: Boolean(resolved)
  };
}

export type EngagementProvenance =
  | "indexed" // projection row present and consistent with chain (or chain not read)
  | "chain-only" // projection row missing, chain has it
  | "chain-ahead" // chain status differs from projection (projection pending)
  | "none";

export function reconcileEngagementProvenance(
  indexedStatus: string | null | undefined,
  chain: ChainEngagement | null | undefined
): EngagementProvenance {
  const indexed = normalizeEngagementStatus(indexedStatus);
  if (!indexed && !chain) return "none";
  if (!indexed && chain) return "chain-only";
  if (!chain) return "indexed";
  return indexed === chain.status ? "indexed" : "chain-ahead";
}
