export type EngagementRef = {
  id: string;
  communityId: number;
  engagementId: number;
};

/** Parses the indexer's composite engagement id ("<communityId>:<engagementId>"). */
export function parseEngagementRef(raw: string): EngagementRef | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const match = /^(\d+):(\d+)$/.exec(decoded.trim());
  if (!match) return null;
  return { id: `${match[1]}:${match[2]}`, communityId: Number(match[1]), engagementId: Number(match[2]) };
}

export function engagementPath(communityId: number | string, engagementId: number | string): string {
  return `/engagements/${encodeURIComponent(`${communityId}:${engagementId}`)}`;
}
