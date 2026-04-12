import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValuableActionReadinessBanner } from "../../../../components/valuable-actions/valuable-action-readiness-banner";

describe("valuable action readiness banner", () => {
  it("renders healthy, lagging, and unavailable states", () => {
    const base = {
      indexedBlock: null,
      chainHeadBlock: null,
      blockLag: null,
      indexedAt: null,
      details: "detail",
      isStale: false,
    };

    const { rerender } = render(<ValuableActionReadinessBanner readiness={{ ...base, status: "healthy" }} />);
    expect(screen.getByText(/healthy/i)).toBeInTheDocument();

    rerender(<ValuableActionReadinessBanner readiness={{ ...base, status: "lagging" }} />);
    expect(screen.getByText(/lagging/i)).toBeInTheDocument();

    rerender(<ValuableActionReadinessBanner readiness={{ ...base, status: "unavailable" }} />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
