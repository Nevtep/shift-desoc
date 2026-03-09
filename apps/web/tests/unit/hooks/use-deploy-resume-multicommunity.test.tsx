import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDeployResume } from "../../../hooks/useDeployResume";
import { saveSession } from "../../../lib/deploy/session-store";
import { createInitialSession } from "../../../lib/deploy/wizard-machine";
import { mockWagmiHooks, TestWrapper } from "../utils";

describe("useDeployResume multi-community targeting", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockWagmiHooks({ connected: true, address: "0xabc1230000000000000000000000000000000000", chainId: 84532 });
  });

  it("resumes explicit target community instead of unrelated unfinished session", async () => {
    const a = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    a.communityId = 1;
    a.targetType = "registered";
    a.status = "in-progress";
    saveSession(a);

    const b = createInitialSession("0xabc1230000000000000000000000000000000000", 84532);
    b.communityId = 2;
    b.targetType = "registered";
    b.status = "failed";
    saveSession(b);

    const { result } = renderHook(
      () =>
        useDeployResume(async (communityId) => ({
          modules: { valuableActionRegistryMatches: communityId === 2 },
          vptInitialized: communityId === 2,
          roles: {
            rrPositionManager: communityId === 2,
            rrDistributor: communityId === 2,
            commerceDisputesCaller: communityId === 2,
            housingMarketplaceCaller: communityId === 2,
            vaIssuerRequestHub: communityId === 2
          },
          marketplaceActive: communityId === 2,
          revenueTreasurySet: communityId === 2
        })),
      { wrapper: TestWrapper }
    );

    const resumed = await result.current.resume({ communityId: 2 });
    expect(resumed?.communityId).toBe(2);
    expect(resumed?.status).toBe("completed");
  });
});
