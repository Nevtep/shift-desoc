import Link from "next/link";

export const metadata = {
  title: "Offers | Shift"
};

export default function OffersPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Marketplace Offers</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Indexed offers with cohort and treasury splits will populate this grid.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Offer data will load after marketplace events are indexed.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/marketplace/offers/new">
          Create offer (future milestone)
        </Link>
        <Link className="underline" href="/marketplace">
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
