import { getI18n } from "../i18n";

// Indexer vocabulary (apps/indexer/src/index.ts): PENDING | APPROVED | REJECTED | REVOKED.
export const ENGAGEMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "REVOKED"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export function normalizeEngagementStatus(raw: string | null | undefined): EngagementStatus | null {
  const upper = (raw ?? "").trim().toUpperCase();
  return (ENGAGEMENT_STATUSES as readonly string[]).includes(upper) ? (upper as EngagementStatus) : null;
}

export function engagementStatusLabel(raw: string | null | undefined): string {
  const labels = getI18n().engagementList.statusLabels;
  const status = normalizeEngagementStatus(raw);
  return status ? labels[status] : (raw ?? "");
}

/** Jurors can only vote while the projection says the engagement is still pending. */
export function isEngagementVotable(raw: string | null | undefined): boolean {
  return normalizeEngagementStatus(raw) === "PENDING";
}
