import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockStepExecutor } from "../../../../lib/deploy/mock-step-executor";

async function finalizeTxCount(mode: string) {
  const executor = createMockStepExecutor();
  const promise = executor(
    "FINALIZE_AUTHORITY_MODE",
    { deploymentConfig: { authorityMode: mode } } as any,
    {} as any
  );
  await vi.advanceTimersByTimeAsync(5000);
  return (await promise).txHashes?.length ?? 0;
}

describe("mock step executor FINALIZE_AUTHORITY_MODE", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits handoff transactions for governance_managed", async () => {
    expect(await finalizeTxCount("governance_managed")).toBe(2);
  });

  it("emits no handoff transactions for admin_managed", async () => {
    expect(await finalizeTxCount("admin_managed")).toBe(0);
  });
});
