import type { ActivityDomain, ActivityPreviewItem } from "./types";

type RawNode = Record<string, unknown>;

export const OVERVIEW_ACTIVITY_LIMIT = 3;

export function buildOverviewActivityQueryVariables(communityId: number): { communityId: number; limit: number } {
  return {
    communityId,
    limit: OVERVIEW_ACTIVITY_LIMIT
  };
}

function toIsoString(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return new Date(0).toISOString();
  }
  return value;
}

export function mapOverviewActivity(domain: ActivityDomain, nodes: RawNode[] | undefined): ActivityPreviewItem[] {
  if (!nodes?.length) return [];
  return nodes.slice(0, OVERVIEW_ACTIVITY_LIMIT).map((item) => {
    const id = String(item.id ?? "unknown");
    const status = String(item.status ?? item.state ?? "unknown");
    const timestamp = toIsoString(item.createdAt ?? item.updatedAt ?? item.queuedAt ?? item.executedAt);

    const titleOrIdentifier =
      String(item.cid ?? item.latestVersionCid ?? id).trim() || id;

    return {
      domain,
      id,
      titleOrIdentifier,
      status,
      timestamp
    };
  });
}

export function newestPreviewTimestamp(itemsByDomain: ActivityPreviewItem[][]): string | null {
  const timestamps = itemsByDomain
    .flat()
    .map((item) => item.timestamp)
    .filter((timestamp) => !Number.isNaN(Date.parse(timestamp)));

  if (!timestamps.length) return null;

  return timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}
