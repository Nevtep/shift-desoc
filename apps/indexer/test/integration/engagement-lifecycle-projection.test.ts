import { describe, expect, it } from "vitest";

import { engagementAppeals, engagements } from "../../ponder.schema";
import {
  projectAppealResolved,
  projectAppealSubmitted,
  projectEngagementResolved,
  projectEngagementRevoked,
  projectEngagementSubmitted,
} from "../../src/engagements/projection";

// Minimal in-memory stand-in for Ponder's context.db (insert/update/select used by the projection).
const createDb = () => {
  const tables = new Map<unknown, Map<string, Record<string, unknown>>>([
    [engagements, new Map()],
    [engagementAppeals, new Map()],
  ]);
  const rows = (table: unknown) => tables.get(table)!;
  const db: any = {
    tables,
    insert(table: unknown) {
      return {
        values(row: Record<string, unknown>) {
          const upsert = (patch: Record<string, unknown> | null) => {
            const id = row.id as string;
            const existing = rows(table).get(id);
            if (!existing) rows(table).set(id, { ...row });
            else if (patch) rows(table).set(id, { ...existing, ...patch });
          };
          return { onConflictDoUpdate: (patch: Record<string, unknown>) => upsert(patch), onConflictDoNothing: () => upsert(null) };
        },
      };
    },
    update(table: unknown, key: { id: string }) {
      return {
        set(patch: Record<string, unknown>) {
          const existing = rows(table).get(key.id);
          if (!existing) throw new Error(`no record ${key.id}`);
          rows(table).set(key.id, { ...existing, ...patch });
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where(expr: { queryChunks: any[] }) {
              const id = expr.queryChunks.find((c) => c && typeof c === "object" && typeof c.value === "string" && !("name" in c))?.value;
              return { limit: async () => (rows(table).has(id) ? [rows(table).get(id)] : []) };
            },
          };
        },
      };
    },
    snapshot: () =>
      JSON.stringify([...tables.values()].map((t) => [...t.entries()]), (_k, v) => (typeof v === "bigint" ? `${v}n` : v)),
  };
  return db;
};

const ev = (eventName: string, tx: string, block: bigint) => ({ eventName, txHash: tx, blockNumber: block });
const T0 = new Date("2026-01-01T00:00:00Z");
const T1 = new Date("2026-01-02T00:00:00Z");

const submit = (db: any, engagementId = 7) =>
  projectEngagementSubmitted(db, {
    communityId: 3,
    engagementId,
    valuableActionId: 2,
    participant: "0xabc",
    evidenceManifestCid: "cid",
    submittedAt: T0,
    evidence: ev("EngagementSubmitted", "0xtx1", 10n),
  });

describe("engagement lifecycle projection", () => {
  it("submit -> resolve(approved) -> revoke stores tallies, status and event evidence", async () => {
    const db = createDb();
    await submit(db);
    await projectEngagementResolved(db, {
      communityId: 3, engagementId: 7, statusIndex: 1, finalApprovals: 2, finalRejections: 1,
      resolvedAt: T1, evidence: ev("EngagementResolved", "0xtx2", 20n),
    });
    expect(db.tables.get(engagements).get("3:7")).toMatchObject({
      status: "APPROVED", approvalsCount: 2, rejectionsCount: 1, resolvedAt: T1,
      lastEventName: "EngagementResolved", lastEventTxHash: "0xtx2", lastEventBlock: 20n, revokedBy: null,
    });

    await projectEngagementRevoked(db, {
      communityId: 3, engagementId: 7, revoker: "0xgov", resolvedAt: T1, evidence: ev("EngagementRevoked", "0xtx3", 30n),
    });
    expect(db.tables.get(engagements).get("3:7")).toMatchObject({
      status: "REVOKED", revokedBy: "0xgov", approvalsCount: 2,
      lastEventName: "EngagementRevoked", lastEventTxHash: "0xtx3", lastEventBlock: 30n,
    });
  });

  it("submit -> reject -> appeal projects a PENDING appeal with tx evidence", async () => {
    const db = createDb();
    await submit(db);
    await projectEngagementResolved(db, {
      communityId: 3, engagementId: 7, statusIndex: 2, finalApprovals: 0, finalRejections: 2,
      resolvedAt: T1, evidence: ev("EngagementResolved", "0xtx2", 20n),
    });
    await projectAppealSubmitted(db, {
      communityId: 3, appealId: 1, engagementId: 7, appellant: "0xabc", reason: "unfair",
      submittedAt: T1, evidence: ev("AppealSubmitted", "0xtx4", 25n),
    });

    expect(db.tables.get(engagementAppeals).get("3:1")).toMatchObject({
      appealId: 1, communityId: 3, engagementId: 7, appellant: "0xabc", reason: "unfair",
      status: "PENDING", txHash: "0xtx4", blockNumber: 25n,
    });
    expect(db.tables.get(engagements).get("3:7")).toMatchObject({ status: "REJECTED", lastEventName: "AppealSubmitted" });
  });

  it("replaying the same events yields identical rows", async () => {
    const run = async (db: any) => {
      await submit(db);
      await projectEngagementResolved(db, {
        communityId: 3, engagementId: 7, statusIndex: 2, finalApprovals: 0, finalRejections: 2,
        resolvedAt: T1, evidence: ev("EngagementResolved", "0xtx2", 20n),
      });
      await projectAppealSubmitted(db, {
        communityId: 3, appealId: 1, engagementId: 7, appellant: "0xabc", reason: "unfair",
        submittedAt: T1, evidence: ev("AppealSubmitted", "0xtx4", 25n),
      });
    };
    const once = createDb();
    await run(once);
    const twice = createDb();
    await run(twice);
    // A replay re-applies the submit/appeal handlers; resolve evidence is re-applied by its own handler.
    await submit(twice);
    await projectEngagementResolved(twice, {
      communityId: 3, engagementId: 7, statusIndex: 2, finalApprovals: 0, finalRejections: 2,
      resolvedAt: T1, evidence: ev("EngagementResolved", "0xtx2", 20n),
    });
    await projectAppealSubmitted(twice, {
      communityId: 3, appealId: 1, engagementId: 7, appellant: "0xabc", reason: "unfair",
      submittedAt: T1, evidence: ev("AppealSubmitted", "0xtx4", 25n),
    });
    expect(twice.tables.get(engagementAppeals).size).toBe(1);
    expect(twice.tables.get(engagements).size).toBe(1);
    expect(twice.snapshot()).toBe(once.snapshot());
  });

  it("AppealResolved is tolerant: updates a projected appeal and ignores an unknown one", async () => {
    const db = createDb();
    await submit(db);
    expect(await projectAppealResolved(db, { communityId: 3, appealId: 9, statusIndex: 1, resolvedAt: T1 })).toBe(false);
    expect(db.tables.get(engagementAppeals).size).toBe(0);

    await projectAppealSubmitted(db, {
      communityId: 3, appealId: 1, engagementId: 7, appellant: "0xabc", reason: "r",
      submittedAt: T0, evidence: ev("AppealSubmitted", "0xtx4", 25n),
    });
    expect(await projectAppealResolved(db, { communityId: 3, appealId: 1, statusIndex: 1, resolvedAt: T1 })).toBe(true);
    expect(db.tables.get(engagementAppeals).get("3:1")).toMatchObject({ status: "APPROVED", resolvedAt: T1 });
  });

  it("keeps appeals scoped per community (same appeal id in two communities)", async () => {
    const db = createDb();
    for (const communityId of [3, 4]) {
      await projectEngagementSubmitted(db, {
        communityId, engagementId: 7, valuableActionId: 2, participant: "0xabc",
        evidenceManifestCid: "cid", submittedAt: T0, evidence: ev("EngagementSubmitted", "0xt", 1n),
      });
      await projectAppealSubmitted(db, {
        communityId, appealId: 1, engagementId: 7, appellant: "0xabc", reason: `c${communityId}`,
        submittedAt: T0, evidence: ev("AppealSubmitted", "0xt", 2n),
      });
    }
    expect(db.tables.get(engagementAppeals).size).toBe(2);
    expect(db.tables.get(engagementAppeals).get("4:1")).toMatchObject({ reason: "c4" });
  });
});
