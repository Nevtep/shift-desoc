import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../../../app/page";
import { renderWithProviders } from "../utils";

describe("Home route composition", () => {
  it("renders deploy wizard above communities index", async () => {
    renderWithProviders(<HomePage />);

    const wizardHeading = await screen.findByText(/Community Deploy Wizard/i);
    const communitiesHeading = await screen.findByText(/Indexed communities/i);

    const wizardSection = wizardHeading.closest("section");
    const communitiesSection = communitiesHeading.closest("section");

    expect(wizardSection).toBeInTheDocument();
    expect(communitiesSection).toBeInTheDocument();

    const wizardIndex = Array.from(document.querySelectorAll("section")).indexOf(wizardSection as HTMLElement);
    const communitiesIndex = Array.from(document.querySelectorAll("section")).indexOf(communitiesSection as HTMLElement);
    expect(wizardIndex).toBeLessThan(communitiesIndex);
  });

  it("keeps coexistence stable for header, wizard, and index sections", async () => {
    renderWithProviders(<HomePage />);
    expect(await screen.findByText(/Shift DeSoc dApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Community Deploy Wizard/i)).toBeInTheDocument();
    expect(screen.getByText(/Indexed communities/i)).toBeInTheDocument();
  });
});
