import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValuableActionActivationControls } from "../../../../components/valuable-actions/valuable-action-activation-controls";

describe("valuable action activation blocked", () => {
  it("disables controls when mode is blocked", () => {
    render(<ValuableActionActivationControls communityId={1} isActive mode="blocked" onToggle={() => undefined} />);

    expect(screen.getByRole("button", { name: /Deactivate/i })).toBeDisabled();
  });
});
