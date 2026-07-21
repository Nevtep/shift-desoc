import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined
  }))
}));

import HousingPage from "../../../app/housing/page";
import ReservationDetailPage from "../../../app/housing/reservations/[reservationId]/page";
import HousingReservationsPage from "../../../app/housing/reservations/page";
import MarketplacePage from "../../../app/marketplace/page";
import OfferDetailPage from "../../../app/marketplace/offers/[offerId]/page";
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

  it("keeps direct offer and reservation detail routes in explicit placeholder state", async () => {
    renderWithProviders(await OfferDetailPage({ params: Promise.resolve({ offerId: "42" }) }));
    expect(screen.getByText(/still a placeholder in manager/i)).toBeInTheDocument();
    expect(screen.getByText(/what is still gated/i)).toBeInTheDocument();

    renderWithProviders(await ReservationDetailPage({ params: Promise.resolve({ reservationId: "7" }) }));
    expect(screen.getAllByText(/still a placeholder in manager/i)).toHaveLength(2);
    expect(screen.getAllByText(/what is still gated/i)).toHaveLength(2);
  });
});