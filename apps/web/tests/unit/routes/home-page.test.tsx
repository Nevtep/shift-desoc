import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../../../app/page";
import { renderWithProviders } from "../utils";

describe("Home route composition", () => {
  it("renders deploy wizard above communities index", async () => {
    renderWithProviders(<HomePage />);

    const wizardHeading = await screen.findByText(/Create your community on Shift/i);
    const communitiesHeading = await screen.findByText(/Indexed communities/i);

    const position = wizardHeading.compareDocumentPosition(communitiesHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps coexistence stable for header, wizard, and index sections", async () => {
    renderWithProviders(<HomePage />);
    expect(await screen.findByText(/Shift DeSoc dApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your community on Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/Indexed communities/i)).toBeInTheDocument();
  });
});
