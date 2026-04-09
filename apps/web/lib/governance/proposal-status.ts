const KNOWN_STATES = ["Pending", "Active", "Succeeded", "Defeated", "Queued", "Executed"] as const;

export type KnownProposalState = (typeof KNOWN_STATES)[number];

export function isKnownProposalState(value: string): value is KnownProposalState {
  return (KNOWN_STATES as readonly string[]).includes(value);
}

export function normalizeProposalStatus(raw: string | null | undefined): KnownProposalState | "Unknown" {
  if (!raw) return "Unknown";
  const normalized = raw.trim();
  if (!normalized) return "Unknown";

  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return isKnownProposalState(title) ? title : "Unknown";
}

export function proposalStatusBadgeLabel(raw: string | null | undefined): string {
  const status = normalizeProposalStatus(raw);
  return status === "Unknown" ? "Unknown" : status;
}
