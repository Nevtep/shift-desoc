import { describe, expect, it } from "vitest";

import { computeActionsHash } from "../../../../lib/actions/bundle-hash";

describe("bundle-hash", () => {
  it("returns the same hash for identical ordered actions", () => {
    const targets = [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002"
    ] as const;
    const values = [0n, 5n] as const;
    const calldatas = ["0x1234", "0xabcd"] as const;

    const hashA = computeActionsHash([...targets], [...values], [...calldatas]);
    const hashB = computeActionsHash([...targets], [...values], [...calldatas]);

    expect(hashA).toBe(hashB);
  });

  it("returns a different hash when queue order changes", () => {
    const targets = [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002"
    ] as const;
    const values = [0n, 5n] as const;
    const calldatas = ["0x1234", "0xabcd"] as const;

    const hashA = computeActionsHash([...targets], [...values], [...calldatas]);
    const hashB = computeActionsHash([targets[1], targets[0]], [values[1], values[0]], [calldatas[1], calldatas[0]]);

    expect(hashA).not.toBe(hashB);
  });

  it("keeps deterministic empty-queue hash semantics", () => {
    const hashA = computeActionsHash([], [], []);
    const hashB = computeActionsHash([], [], []);

    expect(hashA).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashA).toBe(hashB);
  });
});
