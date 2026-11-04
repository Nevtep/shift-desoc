import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessSummary } from "../../../components/communities/overview/access-summary";
import type { AccessInspection } from "../../../lib/community-overview/access-inspection";

const row = (status: "pass" | "fail" | "unavailable") => ({
  targetKey: "marketplace",
  target: "0x0000000000000000000000000000000000000abc" as const,
  signature: "setCommunityActive(bool)",
  expectedRole: "0",
  actualRole: status === "unavailable" ? null : "0",
  status
});

const inspection = (overall: "pass" | "fail" | "unavailable", rows = [row(overall)]): AccessInspection => ({
  holders: [],
  authorityMode: "unavailable",
  overall,
  timelockAdmin: overall,
  rows
});

describe("AccessSummary", () => {
  it("shows a verified signal only when everything passes", () => {
    render(<AccessSummary inspection={inspection("pass")} loading={false} />);
    expect(screen.getByTestId("access-overall")).toHaveTextContent("verified");
  });

  it("shows failing selectors", () => {
    render(<AccessSummary inspection={inspection("fail")} loading={false} />);
    expect(screen.getByTestId("access-overall")).toHaveTextContent("mismatch");
    expect(screen.getByText("setCommunityActive(bool)")).toBeInTheDocument();
  });

  it("never renders verified when data is unavailable or loading", () => {
    const { rerender } = render(<AccessSummary inspection={inspection("unavailable")} loading={false} />);
    expect(screen.getByTestId("access-overall")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("access-overall")).not.toHaveTextContent("verified");
    rerender(<AccessSummary inspection={inspection("pass")} loading />);
    expect(screen.getByTestId("access-overall")).toHaveTextContent("checking");
  });

  it("labels the derived authority mode", () => {
    const { rerender } = render(
      <AccessSummary inspection={{ ...inspection("pass"), authorityMode: "governance_managed" }} loading={false} />
    );
    expect(screen.getByTestId("access-authority-mode")).toHaveTextContent("Governance-managed");
    rerender(<AccessSummary inspection={{ ...inspection("pass"), authorityMode: "admin_managed" }} loading={false} />);
    expect(screen.getByTestId("access-authority-mode")).toHaveTextContent("Admin-managed");
    rerender(<AccessSummary inspection={inspection("unavailable")} loading={false} />);
    expect(screen.getByTestId("access-authority-mode")).toHaveTextContent("unavailable");
    rerender(<AccessSummary inspection={{ ...inspection("pass"), authorityMode: "admin_managed" }} loading />);
    expect(screen.getByTestId("access-authority-mode")).toHaveTextContent("checking");
  });
});
