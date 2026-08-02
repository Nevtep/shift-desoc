import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: (key: string) => (key === "shift_locale" ? { value: "en" } : undefined)
  }))
}));

import HomePage from "../../../app/page";
import { renderWithProviders } from "../utils";

describe("Home route composition", () => {
  it("renders deploy wizard above communities index", async () => {
    renderWithProviders(await HomePage());

    const wizardHeading = await screen.findByText(/Create your community on Shift/i);
    const communitiesHeading = await screen.findByText(/Indexed communities/i);

    const position = wizardHeading.compareDocumentPosition(communitiesHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps coexistence stable for header, wizard, and index sections", async () => {
    renderWithProviders(await HomePage());
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Verifiable coordination for communities that decide and execute together/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Create your community on Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/Indexed communities/i)).toBeInTheDocument();
  });
});
