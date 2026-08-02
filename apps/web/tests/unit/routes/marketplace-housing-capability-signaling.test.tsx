import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: () => undefined
  }))
}));

import HousingPage from "../../../app/housing/page";
import ReservationDetailPage from "../../../app/housing/reservations/[reservationId]/page";
import HousingReservationsPage from "../../../app/housing/reservations/page";
import MarketplacePage from "../../../app/marketplace/page";
import OfferDetailPage from "../../../app/marketplace/offers/[offerId]/page";
import OffersPage from "../../../app/marketplace/offers/page";
import { getManagerCapabilityMetadata } from "../../../lib/community-overview/availability";
import { MANAGER_CAPABILITY_ROUTE_KEYS } from "../../../lib/community-overview/routes";
import { renderWithProviders } from "../utils";

describe("marketplace and housing capability signaling", () => {
  it("renders marketplace section CTAs as disabled coming-soon buttons", async () => {
    renderWithProviders(await MarketplacePage());
    const offersCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFERS);
    const housingCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING);
    const offersButton = screen.getByRole("button", { name: /ofertas|offers/i });
    const housingButton = screen.getByRole("button", { name: /housing/i });

    expect(offersButton).toBeDisabled();
    expect(offersButton).toHaveAttribute("data-capability-key", offersCapability.key);
    expect(offersButton).toHaveAttribute("data-capability-state", offersCapability.status);
    expect(housingButton).toBeDisabled();
    expect(housingButton).toHaveAttribute("data-capability-key", housingCapability.key);
    expect(housingButton).toHaveAttribute("data-capability-state", housingCapability.status);
    expect(screen.getByText(/no operable en manager|non-operable in manager/i)).toBeInTheDocument();
  });

  it("renders housing reservations CTA as disabled until the route is operable", async () => {
    renderWithProviders(await HousingPage());
    const reservationsCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATIONS);
    const reservationsButton = screen.getByRole("button", { name: /ver reservas|view reservations/i });

    expect(reservationsButton).toBeDisabled();
    expect(reservationsButton).toHaveAttribute("data-capability-key", reservationsCapability.key);
    expect(reservationsButton).toHaveAttribute("data-capability-state", reservationsCapability.status);
    expect(screen.getByText(/no operable en manager|non-operable in manager/i)).toBeInTheDocument();
  });

  it("marks offers and housing reservations routes as placeholders instead of live flows", async () => {
    const offersRender = renderWithProviders(await OffersPage());
    const offersCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFERS);
    const offersButton = screen.getByRole("button", { name: /crear oferta|create offer/i });
    expect(offersButton).toBeDisabled();
    expect(offersButton).toHaveAttribute("data-capability-key", offersCapability.key);
    expect(offersButton).toHaveAttribute("data-capability-state", offersCapability.status);
    expect(screen.getByText(/offers permanece en estado placeholder|offers remains a placeholder route/i)).toBeInTheDocument();

    offersRender.unmount();
    const reservationsRender = renderWithProviders(await HousingReservationsPage());
    const reservationsCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATIONS);
    expect(reservationsRender.container.firstElementChild).toHaveAttribute("data-capability-key", reservationsCapability.key);
    expect(reservationsRender.container.firstElementChild).toHaveAttribute("data-capability-state", reservationsCapability.status);
    expect(screen.getByText(/reservas de housing permanece en estado placeholder|housing reservations remains a placeholder route/i)).toBeInTheDocument();
  });

  it("keeps direct offer and reservation detail routes in explicit placeholder state", async () => {
    const offerDetailRender = renderWithProviders(await OfferDetailPage({ params: Promise.resolve({ offerId: "42" }) }));
    const offerDetailCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFER_DETAIL);
    expect(offerDetailRender.container.firstElementChild).toHaveAttribute("data-capability-key", offerDetailCapability.key);
    expect(offerDetailRender.container.firstElementChild).toHaveAttribute("data-capability-state", offerDetailCapability.status);
    expect(screen.getByText(/still a placeholder in manager/i)).toBeInTheDocument();
    expect(screen.getByText(/what is still gated/i)).toBeInTheDocument();

    offerDetailRender.unmount();
    const reservationDetailRender = renderWithProviders(await ReservationDetailPage({ params: Promise.resolve({ reservationId: "7" }) }));
    const reservationDetailCapability = getManagerCapabilityMetadata(
      MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING_RESERVATION_DETAIL
    );
    expect(reservationDetailRender.container.firstElementChild).toHaveAttribute(
      "data-capability-key",
      reservationDetailCapability.key
    );
    expect(reservationDetailRender.container.firstElementChild).toHaveAttribute(
      "data-capability-state",
      reservationDetailCapability.status
    );
    expect(screen.getByText(/still a placeholder in manager/i)).toBeInTheDocument();
    expect(screen.getByText(/what is still gated/i)).toBeInTheDocument();
  });
});
