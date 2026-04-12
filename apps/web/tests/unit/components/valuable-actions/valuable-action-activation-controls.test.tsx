import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ValuableActionActivationControls } from "../../../../components/valuable-actions/valuable-action-activation-controls";

describe("valuable action activation controls", () => {
  it("enables button for governance-required mode", () => {
    const onToggle = vi.fn();
    render(<ValuableActionActivationControls isActive={false} mode="governance_required" onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: /Activate/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
