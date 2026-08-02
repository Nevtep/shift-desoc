import { getManagerCapabilityMetadata } from "../../../../lib/community-overview/availability";
import { MANAGER_CAPABILITY_ROUTE_KEYS } from "../../../../lib/community-overview/routes";

export const metadata = {
  title: "Offer Detail (Coming Soon) | Shift"
};

type PageProps = {
  params: Promise<{
    offerId: string;
  }>;
};

export default async function OfferDetailPage({ params }: PageProps) {
  const { offerId } = await params;
  const capability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFER_DETAIL);

  return (
    <main
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10"
      data-capability-key={capability.key}
      data-capability-state={capability.status}
    >
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Offer</p>
        <h1 className="text-3xl font-semibold">Offer {offerId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This detail route is still a placeholder in Manager. Offer metadata, pricing, and verification
          stats are not yet operable here.
        </p>
      </header>
      <section className="space-y-4">
        <div className="card">
          <h2 className="text-lg font-medium">Current status</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Order, reservation, and settlement history remain unavailable until marketplace projections
            and read models are delivered.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-medium">What is still gated</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dispute timelines, related actions, and offer-specific operations stay blocked here until the
            marketplace and disputes surfaces are implemented.
          </p>
        </div>
      </section>
    </main>
  );
}
