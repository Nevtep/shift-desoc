import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ValuableActionList } from "../../../../components/valuable-actions/valuable-action-list";

describe("ValuableActionList", () => {
  it("renders empty state", () => {
    render(<ValuableActionList communityId={1} actions={[]} readinessStatus="healthy" />);

    expect(screen.getByText(/No valuable actions found/i)).toBeInTheDocument();
  });

  it("renders actions and allows selection", async () => {
    const onSelect = vi.fn();
    render(
      <ValuableActionList
        communityId={1}
        readinessStatus="lagging"
        onSelect={onSelect}
        actions={[
          {
            id: "1:1",
            communityId: 1,
            actionId: 1,
            title: "Review PRs",
            evidenceSpecCid: null,
            metadataSchemaId: null,
            isActive: true,
            lifecycle: {
              createdAtBlock: "1",
              updatedAtBlock: "2",
              activatedAtBlock: "2",
              deactivatedAtBlock: null,
              lastEventTxHash: "0x1",
              lastEventName: "ValuableActionActivated",
            },
            timestamps: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        ]}
      />
    );

    expect(screen.getByText(/Readiness: lagging/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open valuable action 1/i })).toBeInTheDocument();
  });
});
