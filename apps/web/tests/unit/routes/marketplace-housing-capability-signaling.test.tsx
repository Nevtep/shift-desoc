import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined
  }))
}));

import HousingPage from "../../../app/housing/page";
import HousingReservationsPage from "../../../app/housing/reservations/page";
import MarketplacePage from "../../../app/marketplace/page";
import OffersPage from "../../../app/marketplace/offers/page";
import { renderWithProviders } from "../utils";

describe("marketplace and housing capability signaling", () => {
  it("renders marketplace section CTAs as disabled coming-soon buttons", async () => {
    renderWithProviders(await MarketplacePage());

    expect(screen.getByRole("button", { name: /ofertas|offers/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /housing/i })).toBeDisabled();
    expect(screen.getByText(/no operable en manager|non-operable in manager/i)).toBeInTheDocument();
  });

  it("renders housing reservations CTA as disabled until the route is operable", async () => {
    renderWithProviders(await HousingPage());

    expect(screen.getByRole("button", { name: /ver reservas|view reservations/i })).toBeDisabled();
    expect(screen.getByText(/no operable en manager|non-operable in manager/i)).toBeInTheDocument();
  });

  it("marks offers and housing reservations routes as placeholders instead of live flows", async () => {
    renderWithProviders(await OffersPage());
    expect(screen.getByRole("button", { name: /crear oferta|create offer/i })).toBeDisabled();
    expect(screen.getByText(/offers permanece en estado placeholder|offers remains a placeholder route/i)).toBeInTheDocument();

    renderWithProviders(await HousingReservationsPage());
    expect(screen.getByText(/reservas de housing permanece en estado placeholder|housing reservations remains a placeholder route/i)).toBeInTheDocument();
  });
});