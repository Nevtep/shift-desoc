import Link from "next/link";

export const metadata = {
  title: "Marketplace | Shift"
};

export default function MarketplacePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Discover community offers, cohort opportunities, and housing reservations powered by Shift
          modules.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          className="rounded-lg border border-border p-4 shadow-sm transition hover:border-primary"
          href="/marketplace/offers"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Offers</h2>
            <p className="text-sm text-muted-foreground">
              Service and product offers will list here once indexed.
            </p>
          </div>
        </Link>
        <Link
          className="rounded-lg border border-border p-4 shadow-sm transition hover:border-primary"
          href="/housing/reservations"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Housing</h2>
            <p className="text-sm text-muted-foreground">
              Co-housing availability and reservation history.
            </p>
          </div>
        </Link>
      </div>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Marketplace catalog pending GraphQL integration.
      </div>
    </main>
  );
}
