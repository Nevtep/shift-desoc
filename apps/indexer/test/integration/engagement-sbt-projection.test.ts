import { describe, expect, it } from "vitest";

import { engagementSbts, engagements } from "../../ponder.schema";
import { correlateEngagementSbts } from "../../src/engagements/sbt-correlation";
import { projectEngagementResolved, projectEngagementSubmitted } from "../../src/engagements/projection";
import { projectTokenIssued } from "../../src/engagements/sbt-projection";

const createDb = () => {
  const tables = new Map<unknown, Map<string, Record<string, unknown>>>([
    [engagements, new Map()],
    [engagementSbts, new Map()],
  ]);
  return {
    tables,
    insert(table: unknown) {
      return {
        values(row: Record<string, unknown>) {
          const upsert = (patch: Record<string, unknown> | null) => {
            const t = tables.get(table)!;
            const existing = t.get(row.id as string);
            if (!existing) t.set(row.id as string, { ...row });
            else if (patch) t.set(row.id as string, { ...existing, ...patch });
          };
          return { onConflictDoUpdate: (p: Record<string, unknown>) => upsert(p), onConflictDoNothing: () => upsert(null) };
        },
      };
    },
    update(table: unknown, key: { id: string }) {
      return {
        set(patch: Record<string, unknown>) {
          const t = tables.get(table)!;
          t.set(key.id, { ...t.get(key.id)!, ...patch });
        },
      };
    },
  } as any;
};

const T = new Date("2026-01-01T00:00:00Z");

async function approvedEngagement(db: any) {
  await projectEngagementSubmitted(db, {
    communityId: 3, engagementId: 7, valuableActionId: 2, participant: "0xAbC", evidenceManifestCid: "c",
    submittedAt: T, evidence: { eventName: "EngagementSubmitted", txHash: "0xsub", blockNumber: 1n },
  });
  await projectEngagementResolved(db, {
    communityId: 3, engagementId: 7, statusIndex: 1, finalApprovals: 2, finalRejections: 0, resolvedAt: T,
    evidence: { eventName: "EngagementResolved", txHash: "0xres", blockNumber: 5n },
  });
}

const issue = (db: any, over: Partial<Parameters<typeof projectTokenIssued>[1]> = {}) =>
  projectTokenIssued(db, {
    communityId: 3, tokenId: 11, kind: 0, subject: "0xAbC", issuedAt: T,
    txHash: "0xres", blockNumber: 5n, ...over,
  });

describe("engagement SBT projection", () => {
  it("stores TokenIssued scoped by community and is replay-idempotent", async () => {
    const db = createDb();
    await issue(db);
    await issue(db);
    expect(db.tables.get(engagementSbts).size).toBe(1);
    expect(db.tables.get(engagementSbts).get("3:11")).toMatchObject({
      tokenId: 11, kind: "WORK", communityId: 3, subject: "0xAbC", txHash: "0xres", blockNumber: 5n,
    });
    await issue(db, { communityId: 4 });
    expect(db.tables.get(engagementSbts).size).toBe(2);
  });

  it("records the resolution tx hash on the engagement for correlation", async () => {
    const db = createDb();
    await approvedEngagement(db);
    expect(db.tables.get(engagements).get("3:7")).toMatchObject({ resolvedTxHash: "0xres" });
  });
});

describe("correlateEngagementSbts", () => {
  const engagement = { communityId: 3, participant: "0xAbC", status: "APPROVED", resolvedTxHash: "0xres" };
  const sbt = (over = {}) => ({ communityId: 3, tokenId: 11, subject: "0xabc", txHash: "0xres", ...over });

  it("matches a token minted to the participant in the resolution tx (case-insensitive)", () => {
    expect(correlateEngagementSbts(engagement, [sbt()])).toEqual([sbt()]);
  });

  it("does not match an unrelated token (other tx, other subject, other community)", () => {
    expect(correlateEngagementSbts(engagement, [sbt({ txHash: "0xother" })])).toEqual([]);
    expect(correlateEngagementSbts(engagement, [sbt({ subject: "0xdef" })])).toEqual([]);
    expect(correlateEngagementSbts(engagement, [sbt({ communityId: 4 })])).toEqual([]);
  });

  it("matches nothing unless the engagement is APPROVED with a known resolution tx", () => {
    expect(correlateEngagementSbts({ ...engagement, status: "REJECTED" }, [sbt()])).toEqual([]);
    expect(correlateEngagementSbts({ ...engagement, resolvedTxHash: null }, [sbt()])).toEqual([]);
  });
});
