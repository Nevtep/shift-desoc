import Link from "next/link";

export const metadata = {
  title: "Offer Detail | Shift"
};

type PageProps = {
  params: Promise<{
    offerId: string;
  }>;
};

export default async function OfferDetailPage({ params }: PageProps) {
  const { offerId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Offer</p>
        <h1 className="text-3xl font-semibold">Offer {offerId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Offer metadata, pricing, and verification stats will show after the marketplace indexer is wired
          in.
        </p>
      </header>
      <section className="space-y-4">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Order History</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Order and reservation history will render using GraphQL queries.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Disputes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dispute timelines and outcomes appear once the dispute events are ingested.
          </p>
          <Link className="mt-3 inline-flex text-sm underline" href={`/claims?offerId=${offerId}`}>
            View related claims
          </Link>
        </div>
      </section>
    </main>
  );
}
