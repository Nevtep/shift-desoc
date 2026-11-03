import { describe, expect, it } from "vitest";

import { parseChainEngagement, reconcileEngagementProvenance, type ChainEngagement } from "./chain-state";

const tuple = (status: number) => [
  7n,
  "0xabc",
  "cid",
  status,
  1_700_000_000n,
  1_700_086_400n,
  ["0x1", "0x2"],
  2,
  1,
  status !== 0
];

const chain = (status: ChainEngagement["status"]): ChainEngagement => ({
  ...(parseChainEngagement(tuple(0)) as ChainEngagement),
  status
});

describe("parseChainEngagement", () => {
  it("maps the getEngagement tuple", () => {
    expect(parseChainEngagement(tuple(1))).toMatchObject({
      valuableActionId: 7,
      participant: "0xabc",
      status: "APPROVED",
      approvals: 2,
      rejections: 1,
      resolved: true,
      jurors: ["0x1", "0x2"]
    });
  });

  it("returns null for unusable data", () => {
    expect(parseChainEngagement(undefined)).toBeNull();
    expect(parseChainEngagement([1n])).toBeNull();
    expect(parseChainEngagement(tuple(9))).toBeNull();
  });
});

describe("reconcileEngagementProvenance", () => {
  it("is chain-only when the projection row is missing", () => {
    expect(reconcileEngagementProvenance(null, chain("PENDING"))).toBe("chain-only");
  });
  it("is chain-ahead when chain resolved but projection still pending", () => {
    expect(reconcileEngagementProvenance("PENDING", chain("APPROVED"))).toBe("chain-ahead");
  });
  it("is indexed when both agree or chain was not read", () => {
    expect(reconcileEngagementProvenance("APPROVED", chain("APPROVED"))).toBe("indexed");
    expect(reconcileEngagementProvenance("APPROVED", null)).toBe("indexed");
  });
  it("is none when neither side has it", () => {
    expect(reconcileEngagementProvenance(null, null)).toBe("none");
  });
});
