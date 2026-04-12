import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValuableActionDetail } from "../../../../components/valuable-actions/valuable-action-detail";

describe("ValuableActionDetail", () => {
  it("renders placeholder when no action selected", () => {
    render(<ValuableActionDetail action={null} />);

    expect(screen.getByText(/Select a valuable action/i)).toBeInTheDocument();
  });

  it("renders canonical lifecycle fields", () => {
    render(
      <ValuableActionDetail
        action={{
          id: "1:2",
          communityId: 1,
          actionId: 2,
          title: "Publish docs",
          evidenceSpecCid: "cid://spec",
          metadataSchemaId: "schema://docs",
          isActive: false,
          lifecycle: {
            createdAtBlock: "10",
            updatedAtBlock: "20",
            activatedAtBlock: null,
            deactivatedAtBlock: "20",
            lastEventTxHash: "0x123",
            lastEventName: "ValuableActionDeactivated",
          },
          timestamps: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }}
      />
    );

    expect(screen.getByText(/Publish docs/i)).toBeInTheDocument();
    expect(screen.getByText(/ValuableActionDeactivated/i)).toBeInTheDocument();
    expect(screen.getByText(/20/i)).toBeInTheDocument();
  });
});
