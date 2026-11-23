import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TechnicalDetail } from "../../../components/communities/overview/technical-detail";

describe("TechnicalDetail", () => {
  it("is collapsed by default and keeps the technical content inside", () => {
    render(
      <TechnicalDetail>
        <p>Modules summary</p>
      </TechnicalDetail>
    );
    const details = screen.getByTestId("community-technical-detail") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details).toContainElement(screen.getByText("Modules summary"));
    expect(screen.getByText(/Detalle t[eé]cnico/i)).toBeInTheDocument();
  });
});
